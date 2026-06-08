// src/modules/sms-providers/sms-providers.module.ts
import { Module, Global } from '@nestjs/common';
import { SmsService } from './sms.service';
import { ZenviaProvider } from './providers/zenvia.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { InfobipProvider } from './providers/infobip.provider';

@Global()
@Module({
  providers: [SmsService, ZenviaProvider, TwilioProvider, InfobipProvider],
  exports: [SmsService],
})
export class SmsProvidersModule {}
