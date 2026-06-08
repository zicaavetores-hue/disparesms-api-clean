// src/modules/webhooks/webhooks.module.ts
import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { MessagesModule } from '../messages/messages.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [MessagesModule, BillingModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
