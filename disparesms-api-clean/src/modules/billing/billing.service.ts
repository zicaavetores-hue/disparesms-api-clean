// src/modules/billing/billing.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  // ── Pacotes de crédito disponíveis ───────────────────────
  getCreditPackages() {
    return [
      { id: 'pack_1000',  credits: 1000,  price: 150.00, pricePerSms: 0.15, label: 'Starter' },
      { id: 'pack_5000',  credits: 5000,  price: 600.00, pricePerSms: 0.12, label: 'Pro' },
      { id: 'pack_10000', credits: 10000, price: 1000.00, pricePerSms: 0.10, label: 'Business' },
      { id: 'pack_50000', credits: 50000, price: 4000.00, pricePerSms: 0.08, label: 'Enterprise' },
    ];
  }

  // ── Listar planos disponíveis ────────────────────────────
  async getPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true } });
  }

  // ── Histórico de transações ──────────────────────────────
  async getTransactions(tenantId: string, query: any) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(query.limit || 20, 100);

    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { tenantId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creditTransaction.count({ where: { tenantId } }),
    ]);

    return { transactions, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Saldo atual ──────────────────────────────────────────
  async getBalance(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    return {
      creditsBalance: tenant.creditsBalance,
      smsSentMonth: tenant.smsSentMonth,
      plan: { name: tenant.plan.name, smsLimit: tenant.plan.smsLimit },
    };
  }

  // ── Criar cobrança via Asaas (Pix / Boleto / Cartão BR) ──
  async createAsaasCharge(tenantId: string, packageId: string) {
    const pkg = this.getCreditPackages().find(p => p.id === packageId);
    if (!pkg) throw new BadRequestException('Pacote inválido.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const apiKey = this.config.get('ASAAS_API_KEY');
    const env = this.config.get('ASAAS_ENVIRONMENT', 'sandbox');
    const baseUrl = env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!apiKey || apiKey.startsWith('$aact_xxx')) {
      // Modo demo: créditos direto sem pagamento real
      this.logger.warn('Asaas não configurado — modo demo, creditando diretamente');
      return this.creditDirectly(tenantId, pkg.credits, `Demo: ${pkg.label}`);
    }

    try {
      const response = await axios.post(
        `${baseUrl}/payments`,
        {
          customer: tenant.email,
          billingType: 'PIX',
          value: pkg.price,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: `DisparesSMS — ${pkg.credits} créditos SMS`,
          externalReference: `${tenantId}:${packageId}`,
        },
        { headers: { access_token: apiKey } },
      );

      return {
        paymentId: response.data.id,
        pixCode: response.data.pixTransaction?.payload,
        pixQrCode: response.data.pixTransaction?.encodedImage,
        value: pkg.price,
        credits: pkg.credits,
        status: 'PENDING',
        message: 'Pague via Pix para liberar os créditos automaticamente.',
      };
    } catch (error) {
      this.logger.error(`Asaas erro: ${error.response?.data?.errors?.[0]?.description || error.message}`);
      throw new BadRequestException('Erro ao criar cobrança. Tente novamente.');
    }
  }

  // ── Webhook Asaas: confirma pagamento e credita ───────────
  async handleAsaasWebhook(payload: any) {
    if (payload.event !== 'PAYMENT_RECEIVED') return;

    const ref = payload.payment?.externalReference;
    if (!ref) return;

    const [tenantId, packageId] = ref.split(':');
    const pkg = this.getCreditPackages().find(p => p.id === packageId);
    if (!pkg) return;

    await this.creditDirectly(tenantId, pkg.credits, `Pagamento confirmado — ${pkg.label}`);
    this.logger.log(`Créditos ${pkg.credits} adicionados ao tenant ${tenantId}`);
  }

  // ── Adiciona créditos diretamente (admin / webhook) ───────
  async creditDirectly(tenantId: string, amount: number, description: string) {
    return this.prisma.$transaction(async tx => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { creditsBalance: { increment: amount } },
      });
      await tx.creditTransaction.create({
        data: {
          tenantId,
          type: 'PURCHASE',
          amount,
          balance: tenant.creditsBalance,
          description,
        },
      });
      return { creditsAdded: amount, newBalance: tenant.creditsBalance, description };
    });
  }
}
