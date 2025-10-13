import { Module, Global } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService } from './implementations/redis.implements';
import { RedisPort } from '../domain/redis.port';
import { envs } from 'src/config/envs';
import { LoggerModule } from 'src/logging/infraestructure/logger.module';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: 'REDIS_PUBLISHER',
      useFactory: () => {
        return new Redis({
          host: envs.redisHost,
          port: envs.redisPort,
          password: envs.redisPassword,
        });
      },
    },
    {
      provide: 'REDIS_SUBSCRIBER',
      useFactory: () => {
        return new Redis({
          host: envs.redisHost,
          port: envs.redisPort,
          password: envs.redisPassword,
        });
      },
    },
    RedisService,
    {
      provide: RedisPort,
      useExisting: RedisService,
    },
  ],
  exports: ['REDIS_PUBLISHER', 'REDIS_SUBSCRIBER', RedisPort],
})
export class RedisModule {}
