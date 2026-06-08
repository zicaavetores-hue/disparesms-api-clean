// src/modules/sms-providers/providers/zenvia.provider.ts
//
// ✅ COMO CONFIGURAR:
//   1. Acesse: https://app.zenvia.com
//   2. Menu: Configurações → API → Criar token
//   3. Copie o token e adicione no .env como ZENVIA_API_TOKEN=seu_token
//   4. Configure o remetente aprovado: ZENVIA_SENDER=NomeDaMarca
//
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { ISmsProvider, SendSmsDto, SmsResult } from '../interfaces/sms-provider.interface';

@Injectable()
export class ZenviaProvider implements ISmsProvider {
  readonly name = 'ZENVIA';
  private readonly logger = new Logger(ZenviaProvider.name);
  private client: AxiosInstance;

  constructor(private config: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://api.zenvia.com/v2',
      headers: {
        'Content-Type': 'application/json',
        // Token configurado via .env — não hardcode aqui!
        'X-API-TOKEN': this.config.get('ZENVIA_API_TOKEN', ''),
      },
      timeout: 10000,
    });
  }

  async send(dto: SendSmsDto): Promise<SmsResult> {
    const token = this.config.get('ZENVIA_API_TOKEN');

    // Se ainda não tem token configurado, retorna erro claro
    if (!token || token === 'SEU_TOKEN_ZENVIA_AQUI') {
      this.logger.warn('⚠️  ZENVIA_API_TOKEN não configurado no .env');
      return {
        success: false,
        error: 'Zenvia API token não configurado. Adicione ZENVIA_API_TOKEN no .env',
      };
    }

    try {
      const payload = {
        from: {
          type: 'field',
          alias: this.config.get('ZENVIA_SENDER', 'DisparesSMS'),
        },
        to: {
          type: 'whatsapp',  // mude para 'sms' se usar SMS padrão
          number: dto.to.replace('+', ''),
        },
        contents: [
          {
            type: 'text',
            text: dto.body,
          },
        ],
      };

      const response = await this.client.post('/messages', payload);

      return {
        success: true,
        providerMsgId: response.data.id,
        providerStatus: response.data.status || 'SENT',
        cost: 0.15, // custo real virá via webhook
      };

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      this.logger.error(`Zenvia erro: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  async getDeliveryStatus(providerMsgId: string): Promise<string> {
    try {
      const response = await this.client.get(`/messages/${providerMsgId}`);
      return response.data.status || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
