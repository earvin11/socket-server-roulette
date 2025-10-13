import { Module } from '@nestjs/common';
import { WsGateway } from './ws-gateway';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/shared/enums/queues-names.enum';
import { RedisModule } from 'src/redis/infraestructure/redis.module';
import { LoggerModule } from 'src/logging/infraestructure/logger.module';

@Module({
  providers: [WsGateway],
  imports: [
    BullModule.registerQueue({
      name: QueueName.BET,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 5,
      },
    }),
    LoggerModule,
    RedisModule,
  ],
  exports: [WsGateway],
})
export class WsServerModule {}
