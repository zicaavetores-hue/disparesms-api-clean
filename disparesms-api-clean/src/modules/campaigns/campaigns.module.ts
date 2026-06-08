// src/modules/campaigns/campaigns.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { DispatchProcessor } from './processors/dispatch.processor';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
      }),
    }),
    BullModule.registerQueue({ name: 'sms-dispatch' }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, DispatchService, DispatchProcessor],
  exports: [CampaignsService, DispatchService],
})
export class CampaignsModule {}
