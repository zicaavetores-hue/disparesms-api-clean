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
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        try {
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port) || 6379,
              password: url.password || undefined,
              tls: redisUrl.startsWith('rediss://') ? {} : undefined,
            },
          };
        } catch {
          return { connection: { host: 'localhost', port: 6379 } };
        }
      },
    }),
    BullModule.registerQueue({ name: 'sms-dispatch' }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, DispatchService, DispatchProcessor],
  exports: [CampaignsService, DispatchService],
})
export class CampaignsModule {}
