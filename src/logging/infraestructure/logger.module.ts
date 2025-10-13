import { Module } from '@nestjs/common';
import { LoggerPort } from 'src/logging/domain/logger.port';
import { LoggerSeq } from './implementations/logger.seq';
import { SEQ_LOGGER_OPTIONS } from './logger-seq.config';
import { envs } from 'src/config/envs';

@Module({
  providers: [
    LoggerSeq,
    {
      provide: SEQ_LOGGER_OPTIONS,
      useValue: {
        seqUrl: envs.seqUrl,
        apiKey: envs.seqApiKey || '',
        application: 'jackpot-ms',
        minimumLevel: 'information',
      },
    },
    {
      provide: LoggerPort,
      useExisting: LoggerSeq,
    },
  ],
  exports: [LoggerPort],
})
export class LoggerModule {}
