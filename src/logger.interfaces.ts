import { ModuleMetadata } from '@nestjs/common/interfaces';
import { Request } from 'express';

export interface LoggerConfig {
  name: string;
  streamType?: string;
  path?: string;
  errWithStack?: boolean;
  context?: string;
  excludeHeaders?: string[];
  reqIdHeader?: string;
  genReqId?: (r: Request) => string;
}

export interface LoggerConfigAsync extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<LoggerConfig> | LoggerConfig;
  inject?: any[];
}
