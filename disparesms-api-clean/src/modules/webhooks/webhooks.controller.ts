// src/modules/webhooks/webhooks.controller.ts
import { Controller, Post, Body, Headers, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from '../messages/messages.service';
import { BillingService } from '../billing/billing.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private messages: MessagesService,
    private billing: BillingService,
  ) {}

  // ── Webhook Zenvia — status de entrega ───────────────────
  // Configurar em: app.zenvia.com → Configurações → Webhooks
  // URL: https://sua-api.com/api/v1/webhooks/zenvia
  @Post('zenvia')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de status Zenvia' })
  async zenviaWebhook(@Body() payload: any) {
    this.logger.debug(`Zenvia webhook: ${JSON.stringify(payload)}`);
    try {
      // Zenvia envia: { type: 'MESSAGE_STATUS', message: { id, status } }
      const msgId = payload.message?.id;
      const status = payload.message?.status?.code || payload.message?.status;
      if (msgId && status) {
        await this.messages.updateDeliveryStatus(msgId, status, status);
      }
    } catch (e) {
      this.logger.error(`Erro processando webhook Zenvia: ${e.message}`);
    }
    return { ok: true };
  }

  // ── Webhook Twilio — status de entrega ───────────────────
  // Configurar em: console.twilio.com → Phone Numbers → Webhooks
  // URL: https://sua-api.com/api/v1/webhooks/twilio
  @Post('twilio')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de status Twilio' })
  async twilioWebhook(@Body() payload: any) {
    this.logger.debug(`Twilio webhook: SID=${payload.MessageSid}, Status=${payload.MessageStatus}`);
    try {
      if (payload.MessageSid && payload.MessageStatus) {
        await this.messages.updateDeliveryStatus(
          payload.MessageSid,
          payload.MessageStatus,
          payload.MessageStatus,
        );
      }
    } catch (e) {
      this.logger.error(`Erro processando webhook Twilio: ${e.message}`);
    }
    return '';  // Twilio espera resposta vazia
  }

  // ── Webhook Infobip — status de entrega ──────────────────
  @Post('infobip')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de status Infobip' })
  async infobipWebhook(@Body() payload: any) {
    try {
      const results = payload.results || [];
      for (const r of results) {
        await this.messages.updateDeliveryStatus(r.messageId, r.status?.name, r.status?.name);
      }
    } catch (e) {
      this.logger.error(`Erro processando webhook Infobip: ${e.message}`);
    }
    return { ok: true };
  }

  // ── Webhook Asaas — confirmação de pagamento ─────────────
  // Configurar em: asaas.com → Configurações → Notificações
  // URL: https://sua-api.com/api/v1/webhooks/asaas
  @Post('asaas')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de pagamento Asaas' })
  async asaasWebhook(@Body() payload: any) {
    this.logger.debug(`Asaas webhook: ${payload.event}`);
    try {
      await this.billing.handleAsaasWebhook(payload);
    } catch (e) {
      this.logger.error(`Erro processando webhook Asaas: ${e.message}`);
    }
    return { ok: true };
  }
}
