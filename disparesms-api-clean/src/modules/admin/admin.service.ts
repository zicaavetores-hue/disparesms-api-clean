// src/modules/admin/admin.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private billing: BillingService) {}

  private assertAdmin(user: any) {
    if (user.role !== 'OWNER' || user.tenant.slug !== 'disparesms-admin') {
      throw new ForbiddenException('Acesso restrito ao administrador da plataforma.');
    }
  }

  // ── Overview da plataforma ───────────────────────────────
  async getPlatformStats(user: any) {
    this.assertAdmin(user);

    const [totalTenants, activeTenants, totalMessages, totalSmsSent, revenue] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { status: { in: ['SENT', 'DELIVERED'] } } }),
      this.prisma.creditTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'PURCHASE', amount: { gt: 0 } },
      }),
    ]);

    return {
      tenants: { total: totalTenants, active: activeTenants },
      messages: { total: totalMessages, sent: totalSmsSent },
      revenue: { totalCredits: revenue._sum.amount || 0 },
    };
  }

  // ── Listar todos os tenants ──────────────────────────────
  async getTenants(user: any, query: any) {
    this.assertAdmin(user);
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(query.limit || 20, 100);

    const where = {
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as any } },
          { email: { contains: query.search, mode: 'insensitive' as any } },
        ],
      }),
      ...(query.status && { status: query.status }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { name: true } },
          _count: { select: { users: true, campaigns: true, messages: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { tenants, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Suspender / reativar tenant ──────────────────────────
  async setTenantStatus(user: any, tenantId: string, status: 'ACTIVE' | 'SUSPENDED') {
    this.assertAdmin(user);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    return this.prisma.tenant.update({ where: { id: tenantId }, data: { status } });
  }

  // ── Adicionar créditos manualmente ──────────────────────
  async grantCredits(user: any, tenantId: string, amount: number, reason: string) {
    this.assertAdmin(user);
    return this.billing.creditDirectly(tenantId, amount, `[Admin] ${reason}`);
  }

  // ── Detalhes de um tenant específico ────────────────────
  async getTenantDetail(user: any, tenantId: string) {
    this.assertAdmin(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        users: { select: { id: true, name: true, email: true, role: true, lastLoginAt: true } },
        _count: { select: { campaigns: true, messages: true, contacts: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    return tenant;
  }
}
