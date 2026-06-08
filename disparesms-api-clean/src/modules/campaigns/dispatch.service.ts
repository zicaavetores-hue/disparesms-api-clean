// src/modules/campaigns/dispatch.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SmsService } from '../sms-providers/sms.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @InjectQueue('sms-dispatch') private queue: Queue,
    private prisma: PrismaService,
    private sms: SmsService,
  ) {}

  // ── Enfileira todos os SMS da campanha ───────────────────
  async enqueueCampaign(campaignId: string, tenantId: string, listIds: string[]) {
    // Busca todos os contatos das listas (sem repetição)
    const members = await this.prisma.contactListMember.findMany({
      where: {
        listId: { in: listIds },
        contact: { optedOut: false, isActive: true, tenantId },
      },
      include: { contact: true },
      distinct: ['contactId'],
    });

    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });

    // Cria registro de mensagem para cada contato e enfileira job
    const jobs = [];
    for (const member of members) {
      const body = this.interpolate(campaign.messageBody, {
        nome: member.contact.name || '',
        telefone: member.contact.phone,
        ...(member.contact.variables as object || {}),
      });

      // Cria registro no banco com status QUEUED
      const message = await this.prisma.message.create({
        data: {
          tenantId,
          campaignId,
          contactId: member.contact.id,
          phone: member.contact.phone,
          body,
          status: 'QUEUED',
        },
      });

      jobs.push({
        name: 'send-sms',
        data: { messageId: message.id, tenantId, phone: member.contact.phone, body },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      });
    }

    // Adiciona todos os jobs à fila em lote (mais eficiente)
    await this.queue.addBulk(jobs);
    this.logger.log(`${jobs.length} SMS enfileirados para campanha ${campaignId}`);
    return jobs.length;
  }

  // ── Envia um SMS transacional avulso ─────────────────────
  async sendTransactional(tenantId: string, to: string, body: string, provider?: string) {
    // Verifica créditos
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant.creditsBalance < 1) throw new Error('Créditos insuficientes.');

    // Cria registro
    const message = await this.prisma.message.create({
      data: { tenantId, phone: to, body, status: 'QUEUED', provider: (provider as any) || 'ZENVIA' },
    });

    // Dispara imediatamente (sem fila para transacional)
    const result = await this.sms.send({ to, body }, provider);

    // Atualiza status
    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        providerMsgId: result.providerMsgId,
        providerStatus: result.providerStatus,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : null,
      },
    });

    // Debita crédito
    if (result.success) {
      await this.debitCredit(tenantId, 1, `SMS transacional para ${to}`);
    }

    return { success: result.success, messageId: message.id, error: result.error };
  }

  // ── Processa um job da fila (chamado pelo Processor) ─────
  async processJob(messageId: string, tenantId: string, phone: string, body: string) {
    try {
      // Marca como SENDING
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: 'SENDING' },
      });

      // Envia via provedor SMS
      const result = await this.sms.send({ to: phone, body });

      // Atualiza resultado
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          providerMsgId: result.providerMsgId,
          providerStatus: result.providerStatus,
          errorMessage: result.error,
          sentAt: result.success ? new Date() : null,
          failedAt: !result.success ? new Date() : null,
        },
      });

      // Debita crédito se enviou com sucesso
      if (result.success) {
        await this.debitCredit(tenantId, 1, `SMS campanha`);
        await this.incrementCampaignCounter(messageId, 'sentCount');
      } else {
        await this.incrementCampaignCounter(messageId, 'failedCount');
      }

      return result;
    } catch (error) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { status: 'FAILED', errorMessage: error.message, failedAt: new Date() },
      });
      throw error;
    }
  }

  // ── Debita créditos do tenant ────────────────────────────
  async debitCredit(tenantId: string, amount: number, description: string) {
    await this.prisma.$transaction(async tx => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          creditsBalance: { decrement: amount },
          smsSentMonth: { increment: amount },
        },
      });
      await tx.creditTransaction.create({
        data: {
          tenantId,
          type: 'SMS_DEBIT',
          amount: -amount,
          balance: tenant.creditsBalance,
          description,
        },
      });
    });
  }

  // ── Incrementa contador da campanha ─────────────────────
  private async incrementCampaignCounter(messageId: string, field: 'sentCount' | 'failedCount' | 'deliveredCount') {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { campaignId: true },
    });
    if (!message?.campaignId) return;

    await this.prisma.campaign.update({
      where: { id: message.campaignId },
      data: { [field]: { increment: 1 } },
    });

    // Verifica se campanha completou
    const campaign = await this.prisma.campaign.findUnique({ where: { id: message.campaignId } });
    const done = (campaign.sentCount + campaign.failedCount) >= campaign.totalMessages;
    if (done && campaign.status === 'RUNNING') {
      await this.prisma.campaign.update({
        where: { id: message.campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      this.logger.log(`Campanha ${message.campaignId} concluída!`);
    }
  }

  // ── Substitui variáveis na mensagem ─────────────────────
  interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  }
}
