// src/modules/campaigns/campaigns.service.ts
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { DispatchService } from './dispatch.service';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private dispatch: DispatchService,
  ) {}

  // ── Listar campanhas ─────────────────────────────────────
  async findAll(tenantId: string, query: any) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(query.limit || 10, 50);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
    };

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { lists: { include: { list: { select: { id: true, name: true, count: true } } } } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, total, page, pages: Math.ceil(total / limit) };
  }

  // ── Buscar campanha ──────────────────────────────────────
  async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        lists: { include: { list: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  // ── Criar campanha ───────────────────────────────────────
  async create(tenantId: string, dto: CreateCampaignDto) {
    // Valida que as listas pertencem ao tenant
    if (dto.listIds?.length) {
      const lists = await this.prisma.contactList.findMany({
        where: { id: { in: dto.listIds }, tenantId },
      });
      if (lists.length !== dto.listIds.length) {
        throw new BadRequestException('Uma ou mais listas não encontradas.');
      }
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name,
        messageBody: dto.messageBody,
        type: dto.type || 'MARKETING',
        status: 'DRAFT',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        lists: dto.listIds?.length
          ? { create: dto.listIds.map(listId => ({ listId })) }
          : undefined,
      },
      include: { lists: { include: { list: true } } },
    });

    this.logger.log(`Campanha criada: ${campaign.id} | tenant: ${tenantId}`);
    return campaign;
  }

  // ── Atualizar campanha (apenas DRAFT) ────────────────────
  async update(tenantId: string, id: string, dto: Partial<CreateCampaignDto>) {
    const campaign = await this.findOne(tenantId, id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Apenas campanhas em rascunho podem ser editadas.');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        messageBody: dto.messageBody,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
  }

  // ── Cancelar campanha ────────────────────────────────────
  async cancel(tenantId: string, id: string) {
    const campaign = await this.findOne(tenantId, id);
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Apenas campanhas em rascunho ou agendadas podem ser canceladas.');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ── Disparar campanha ────────────────────────────────────
  async launch(tenantId: string, id: string) {
    const campaign = await this.findOne(tenantId, id);

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException('Esta campanha não pode ser disparada.');
    }

    // Conta total de destinatários
    const listIds = campaign.lists.map((cl: any) => cl.listId);
    if (!listIds.length) throw new BadRequestException('Adicione ao menos uma lista de contatos.');

    const totalContacts = await this.prisma.contactListMember.count({
      where: {
        listId: { in: listIds },
        contact: { optedOut: false, isActive: true },
      },
    });

    if (totalContacts === 0) {
      throw new BadRequestException('Nenhum contato ativo nas listas selecionadas.');
    }

    // Verifica saldo de créditos do tenant
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant.creditsBalance < totalContacts) {
      throw new ForbiddenException(
        `Créditos insuficientes. Necessário: ${totalContacts}, disponível: ${tenant.creditsBalance}.`,
      );
    }

    // Atualiza status para RUNNING
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date(), totalMessages: totalContacts },
    });

    // Enfileira o disparo em background
    await this.dispatch.enqueueCampaign(campaign.id, tenantId, listIds);

    this.logger.log(`Campanha ${id} disparada para ${totalContacts} contatos`);
    return { ...updated, totalContacts };
  }

  // ── Relatório da campanha ────────────────────────────────
  async getStats(tenantId: string, id: string) {
    const campaign = await this.findOne(tenantId, id);

    const stats = await this.prisma.message.groupBy({
      by: ['status'],
      where: { campaignId: id, tenantId },
      _count: true,
    });

    const breakdown = stats.reduce((acc, s) => {
      acc[s.status.toLowerCase()] = s._count;
      return acc;
    }, {} as Record<string, number>);

    const total = campaign.totalMessages;
    const delivered = breakdown.delivered || 0;
    const failed = breakdown.failed || 0;
    const sent = breakdown.sent || 0;
    const queued = breakdown.queued || 0;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        scheduledAt: campaign.scheduledAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      stats: {
        total,
        queued,
        sent,
        delivered,
        failed,
        deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(1) + '%' : '0%',
        failRate: total > 0 ? ((failed / total) * 100).toFixed(1) + '%' : '0%',
      },
      breakdown,
    };
  }
}
