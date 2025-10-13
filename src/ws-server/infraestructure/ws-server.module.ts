import { Module } from '@nestjs/common';
import { WsGateway } from './ws-gateway';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/shared/enums/queues-names.enum';

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
  ],
  exports: [WsGateway],
})
export class WsServerModule {}
