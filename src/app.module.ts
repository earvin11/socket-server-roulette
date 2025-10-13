import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { BullModule } from '@nestjs/bullmq';
import { envs } from './config/envs';
import { WsServerModule } from './ws-server/infraestructure/ws-server.module';
import { RedisModule } from './redis/infraestructure/redis.module';
import { LoggerModule } from './logging/infraestructure/logger.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: envs.redisHost,
        port: envs.redisPort,
        password: envs.redisPassword,
      },
    }),
    LoggerModule,
    RedisModule,
    WsServerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
