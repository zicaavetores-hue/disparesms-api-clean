// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { MessagesModule } from './modules/messages/messages.module';
import { BillingModule } from './modules/billing/billing.module';
import { SmsProvidersModule } from './modules/sms-providers/sms-providers.module';
import { AdminModule } from './modules/admin/admin.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    // Configuração de env vars
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Rate limiting — evita abuso da API
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Agendamento (cron jobs para campanhas)
    ScheduleModule.forRoot(),

    // Módulos da aplicação
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ContactsModule,
    CampaignsModule,
    MessagesModule,
    BillingModule,
    SmsProvidersModule,
    AdminModule,
    WebhooksModule,
  ],
})
export class AppModule {}
