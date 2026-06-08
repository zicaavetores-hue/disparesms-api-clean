// src/modules/sms-providers/providers/infobip.provider.ts
//
// ✅ COMO CONFIGURAR:
//   1. Acesse: https://portal.infobip.com
//   2. Developers → API Keys → Create API Key
//   3. Adicione no .env: INFOBIP_BASE_URL e INFOBIP_API_KEY
//
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ISmsProvider, SendSmsDto, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class InfobipProvider implements ISmsProvider {
  readonly name = 'INFOBIP';
  private readonly logger = new Logger(InfobipProvider.name);
  private client: AxiosInstance;

  constructor(private config: ConfigService) {
    this.client = axios.create({
      baseURL: this.config.get('INFOBIP_BASE_URL', 'https://api.infobip.com'),
      headers: {
        Authorization: `App ${this.config.get('INFOBIP_API_KEY', '')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 10000,
    });
  }

  async send(dto: SendSmsDto): Promise<SmsResult> {
    const apiKey = this.config.get('INFOBIP_API_KEY');
    if (!apiKey || apiKey === 'SEU_API_KEY_INFOBIP') {
      return { success: false, error: 'Infobip não configurado no .env' };
    }

    try {
      const payload = {
        messages: [
          {
            from: this.config.get('INFOBIP_SENDER', 'DisparesSMS'),
            destinations: [{ to: dto.to.replace('+', '') }],
            text: dto.body,
          },
        ],
      };

      const response = await this.client.post('/sms/2/text/advanced', payload);
      const msg = response.data.messages?.[0];

      return {
        success: msg?.status?.groupName !== 'REJECTED',
        providerMsgId: msg?.messageId,
        providerStatus: msg?.status?.name,
        cost: 0,
      };

    } catch (error) {
      const msg = error.response?.data?.requestError?.serviceException?.text || error.message;
      this.logger.error(`Infobip erro: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async getDeliveryStatus(providerMsgId: string): Promise<string> {
    try {
      const response = await this.client.get(`/sms/1/reports?messageId=${providerMsgId}`);
      return response.data.results?.[0]?.status?.name || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
