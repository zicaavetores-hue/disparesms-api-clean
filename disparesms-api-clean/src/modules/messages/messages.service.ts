// src/modules/messages/messages.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, query: any) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.status && { status: query.status }),
      ...(query.campaignId && { campaignId: query.campaignId }),
      ...(query.phone && { phone: { contains: query.phone } }),
      ...(query.from && { createdAt: { gte: new Date(query.from) } }),
      ...(query.to && { createdAt: { lte: new Date(query.to) } }),
    };

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { campaign: { select: { id: true, name: true } } },
      }),
      this.prisma.message.count({ where }),
    ]);

    return { messages, total, page, pages: Math.ceil(total / limit) };
  }

  // Dashboard: métricas do período
  async getDashboardStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalMonth,
      deliveredMonth,
      failedMonth,
      tenant,
      recentCampaigns,
      dailyVolume,
    ] = await Promise.all([
      this.prisma.message.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      this.prisma.message.count({ where: { tenantId, status: 'DELIVERED', createdAt: { gte: startOfMonth } } }),
      this.prisma.message.count({ where: { tenantId, status: 'FAILED', createdAt: { gte: startOfMonth } } }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      }),
      this.prisma.campaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, status: true, totalMessages: true, deliveredCount: true, createdAt: true },
      }),
      // Volume diário últimos 7 dias
      this.prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
        FROM messages
        WHERE tenant_id = ${tenantId}
          AND created_at >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
    ]);

    return {
      credits: {
        balance: tenant.creditsBalance,
        usedThisMonth: tenant.smsSentMonth,
        planLimit: tenant.plan.smsLimit,
      },
      sms: {
        totalMonth,
        deliveredMonth,
        failedMonth,
        deliveryRate: totalMonth > 0 ? ((deliveredMonth / totalMonth) * 100).toFixed(1) : '0',
      },
      recentCampaigns,
      dailyVolume,
    };
  }

  // Webhook de entrega recebido do provedor
  async updateDeliveryStatus(providerMsgId: string, status: string, providerStatus: string) {
    const message = await this.prisma.message.findFirst({ where: { providerMsgId } });
    if (!message) return;

    const mappedStatus = this.mapProviderStatus(status);
    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: mappedStatus as any,
        providerStatus,
        deliveredAt: mappedStatus === 'DELIVERED' ? new Date() : undefined,
        failedAt: mappedStatus === 'FAILED' ? new Date() : undefined,
      },
    });

    // Atualiza contador de entregues na campanha
    if (mappedStatus === 'DELIVERED' && message.campaignId) {
      await this.prisma.campaign.update({
        where: { id: message.campaignId },
        data: { deliveredCount: { increment: 1 } },
      });
    }
  }

  private mapProviderStatus(raw: string): string {
    const map: Record<string, string> = {
      delivered: 'DELIVERED', DELIVERED: 'DELIVERED', received: 'DELIVERED',
      failed: 'FAILED', FAILED: 'FAILED', undelivered: 'UNDELIVERED',
      sent: 'SENT', SENT: 'SENT', queued: 'QUEUED',
    };
    return map[raw] || 'SENT';
  }
}
