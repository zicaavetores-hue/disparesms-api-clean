// src/modules/sms-providers/sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZenviaProvider } from './providers/zenvia.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { InfobipProvider } from './providers/infobip.provider';
import { SendSmsDto, SmsResult, ISmsProvider } from './interfaces/sms-provider.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private config: ConfigService,
    private zenvia: ZenviaProvider,
    private twilio: TwilioProvider,
    private infobip: InfobipProvider,
  ) {}

  // ── Enviar SMS com seleção de provedor ───────────────────
  async send(dto: SendSmsDto, preferredProvider?: string): Promise<SmsResult> {
    const provider = this.getProvider(preferredProvider);

    try {
      this.logger.debug(`Enviando SMS para ${dto.to} via ${provider.name}`);
      const result = await provider.send(dto);

      if (result.success) {
        this.logger.debug(`SMS enviado com sucesso. ID: ${result.providerMsgId}`);
        return result;
      }

      // Tenta fallback se o provedor principal falhar
      return await this.fallback(dto, provider.name);

    } catch (error) {
      this.logger.warn(`Provedor ${provider.name} falhou: ${error.message}. Tentando fallback...`);
      return await this.fallback(dto, provider.name);
    }
  }

  // ── Fallback automático para outro provedor ───────────────
  private async fallback(dto: SendSmsDto, failedProvider: string): Promise<SmsResult> {
    const fallbackOrder = ['ZENVIA', 'TWILIO', 'INFOBIP'].filter(p => p !== failedProvider);

    for (const providerName of fallbackOrder) {
      try {
        const provider = this.getProvider(providerName);
        this.logger.warn(`Tentando fallback com ${providerName}`);
        const result = await provider.send(dto);
        if (result.success) return result;
      } catch (e) {
        this.logger.error(`Fallback ${providerName} também falhou: ${e.message}`);
      }
    }

    return { success: false, error: 'Todos os provedores falharam.' };
  }

  // ── Seleciona o provedor certo ───────────────────────────
  private getProvider(name?: string): ISmsProvider {
    const target = name || this.config.get('SMS_DEFAULT_PROVIDER', 'ZENVIA');
    const providers: Record<string, ISmsProvider> = {
      ZENVIA: this.zenvia,
      TWILIO: this.twilio,
      INFOBIP: this.infobip,
    };
    return providers[target] || this.zenvia;
  }

  // ── Buscar status de entrega ─────────────────────────────
  async getDeliveryStatus(providerMsgId: string, provider: string): Promise<string> {
    return this.getProvider(provider).getDeliveryStatus(providerMsgId);
  }
}
