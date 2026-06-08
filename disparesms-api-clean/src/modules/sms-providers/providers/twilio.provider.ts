// src/modules/sms-providers/providers/twilio.provider.ts
//
// ✅ COMO CONFIGURAR:
//   1. Acesse: https://console.twilio.com
//   2. Copie Account SID e Auth Token da página inicial
//   3. Adicione no .env: TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN
//   4. Compre um número: Console → Phone Numbers → Buy → SMS capable
//   5. Adicione: TWILIO_FROM_NUMBER=+15551234567
//
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISmsProvider, SendSmsDto, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  readonly name = 'TWILIO';
  private readonly logger = new Logger(TwilioProvider.name);

  constructor(private config: ConfigService) {}

  async send(dto: SendSmsDto): Promise<SmsResult> {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    const from = this.config.get('TWILIO_FROM_NUMBER');

    if (!accountSid || accountSid.startsWith('AC00')) {
      return { success: false, error: 'Twilio não configurado no .env' };
    }

    try {
      const params = new URLSearchParams({
        To: dto.to,
        From: from,
        Body: dto.body,
      });

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        params.toString(),
        {
          auth: { username: accountSid, password: authToken },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );

      return {
        success: true,
        providerMsgId: response.data.sid,
        providerStatus: response.data.status,
        cost: parseFloat(response.data.price || '0') * -1,
      };

    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`Twilio erro: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async getDeliveryStatus(providerMsgId: string): Promise<string> {
    const accountSid = this.config.get('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get('TWILIO_AUTH_TOKEN');
    try {
      const response = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${providerMsgId}.json`,
        { auth: { username: accountSid, password: authToken } },
      );
      return response.data.status?.toUpperCase() || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
