import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import * as Bunyan from 'bunyan';
import * as Express from 'express';
import { getClientIp } from 'request-ip';
import { ServerResponse } from 'http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as util from 'util';

import { LoggerConfig } from './logger.interfaces';
import { isMatch } from './logger.utils';

export class RequestInterceptor implements NestInterceptor {
  private readonly _logger: Bunyan;

  constructor(rootLogger: Bunyan, private readonly options: LoggerConfig) {
    this._logger = rootLogger.child({
      context: options.context || 'RequestTrack',
    });
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const start = new Date();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Express.Request>();
    const res = ctx.getResponse<ServerResponse>();
    const method = req.method;
    const url = req.url;
    const route = req.route.path;

    const options = this.options;
    const reqId = options.genReqId
      ? options.genReqId(req)
      : req.headers[options.reqIdHeader || 'x-transaction-id'];
    const data: { [key: string]: any } = {
      method,
      url,
      route,
      req_id: reqId,
      transactionId: reqId,
    };

    data.ip = getClientIp(req);

    data.headers = { ...req.headers };

    for (const h of options.excludeHeaders || []) {
      delete data.headers[h];
    }
    if (req.body) {
      data['short-body'] = buildShortBody(req.body, options.shortBodyLength);
    }

    const skipLogging = isMatch(url, options.excludeReqPath);
    if (!skipLogging) {
      // TODO is it better to feed req to the bunyan.stdSerializers.req?
      this._logger.info({ direction: 'inbound', ...data });
    }

    const logging = (err?, body?) => {
      if (skipLogging) {
        return;
      }
      const common = {
        direction: 'outbound',
        'response-time': new Date().getTime() - start.getTime(),
        method,
        route,
        url,
        req_id: reqId,
        transactionId: reqId,
      };
      if (err) {
        this._logger.error({
          ...common,
          'status-code': err.status || 500,
          err,
        });
        return;
      }
      this._logger.info({
        ...common,
        'short-body': body && buildShortBody(body, options.shortBodyLength),
        'status-code': res.statusCode,
      });
    };
    return next
      .handle()
      .pipe(tap({ next: (v) => logging(null, v), error: logging }));
  }
}

function buildShortBody(raw, length = 500) {
  return util
    .inspect(raw, { depth: 3, maxStringLength: 50 })
    .substring(0, length);
}
