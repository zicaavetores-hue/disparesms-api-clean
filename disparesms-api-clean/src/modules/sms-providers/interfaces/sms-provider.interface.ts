// src/modules/sms-providers/interfaces/sms-provider.interface.ts
export interface SendSmsDto {
  to: string;        // E.164 format: +5544999999999
  body: string;
  sender?: string;
}

export interface SmsResult {
  success: boolean;
  providerMsgId?: string;
  providerStatus?: string;
  cost?: number;
  error?: string;
}

export interface ISmsProvider {
  name: string;
  send(dto: SendSmsDto): Promise<SmsResult>;
  getDeliveryStatus(providerMsgId: string): Promise<string>;
}
