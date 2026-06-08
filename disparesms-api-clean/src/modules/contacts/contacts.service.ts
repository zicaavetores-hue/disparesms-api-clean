// src/modules/contacts/contacts.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateListDto } from './dto/create-list.dto';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private prisma: PrismaService) {}

  // ── CONTATOS ────────────────────────────────────────────

  async findAll(tenantId: string, query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as any } },
          { phone: { contains: query.search } },
          { email: { contains: query.search, mode: 'insensitive' as any } },
        ],
      }),
    };

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    return contact;
  }

  async create(tenantId: string, dto: CreateContactDto) {
    const phone = this.normalizePhone(dto.phone);

    const existing = await this.prisma.contact.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    if (existing) throw new BadRequestException('Telefone já cadastrado nesta conta.');

    return this.prisma.contact.create({
      data: { tenantId, phone, name: dto.name, email: dto.email, tags: dto.tags || [], source: 'manual' },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateContactDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.contact.update({ where: { id }, data: { isActive: false } });
    return { message: 'Contato removido com sucesso.' };
  }

  async optOut(tenantId: string, phone: string) {
    const normalized = this.normalizePhone(phone);
    await this.prisma.contact.updateMany({
      where: { tenantId, phone: normalized },
      data: { optedOut: true, optedOutAt: new Date() },
    });
  }

  // ── IMPORTAÇÃO CSV ──────────────────────────────────────
  async importCsv(tenantId: string, buffer: Buffer, listId?: string): Promise<{
    imported: number; skipped: number; errors: string[];
  }> {
    this.logger.log(`Iniciando importação CSV para tenant ${tenantId}`);

    const rows: any[] = await this.parseCsv(buffer);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const phone = this.normalizePhone(row.phone || row.telefone || row.numero || row.celular);
        if (!phone) { errors.push(`Linha ignorada — sem telefone: ${JSON.stringify(row)}`); skipped++; continue; }

        // Upsert: atualiza se existir, cria se não existir
        const contact = await this.prisma.contact.upsert({
          where: { tenantId_phone: { tenantId, phone } },
          update: {
            name: row.name || row.nome || undefined,
            email: row.email || undefined,
            tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : undefined,
          },
          create: {
            tenantId,
            phone,
            name: row.name || row.nome || null,
            email: row.email || null,
            tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
            source: 'csv_import',
          },
        });

        // Adiciona à lista se fornecida
        if (listId) {
          await this.prisma.contactListMember.upsert({
            where: { contactId_listId: { contactId: contact.id, listId } },
            update: {},
            create: { contactId: contact.id, listId },
          }).catch(() => {}); // ignora duplicata
        }

        imported++;
      } catch (e) {
        errors.push(`Erro na linha: ${e.message}`);
        skipped++;
      }
    }

    // Atualiza contador da lista
    if (listId) {
      const count = await this.prisma.contactListMember.count({ where: { listId } });
      await this.prisma.contactList.update({ where: { id: listId }, data: { count } });
    }

    this.logger.log(`CSV importado: ${imported} criados, ${skipped} ignorados`);
    return { imported, skipped, errors };
  }

  // ── LISTAS ─────────────────────────────────────────────

  async getLists(tenantId: string) {
    return this.prisma.contactList.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async createList(tenantId: string, dto: CreateListDto) {
    return this.prisma.contactList.create({
      data: { tenantId, name: dto.name, description: dto.description },
    });
  }

  async getListContacts(tenantId: string, listId: string, query: any) {
    const list = await this.prisma.contactList.findFirst({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Lista não encontrada.');

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);

    const members = await this.prisma.contactListMember.findMany({
      where: { listId },
      skip: (page - 1) * limit,
      take: limit,
      include: { contact: true },
    });

    return { list, contacts: members.map(m => m.contact), total: list.count };
  }

  async addContactsToList(tenantId: string, listId: string, contactIds: string[]) {
    const list = await this.prisma.contactList.findFirst({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Lista não encontrada.');

    await this.prisma.contactListMember.createMany({
      data: contactIds.map(contactId => ({ contactId, listId })),
      skipDuplicates: true,
    });

    const count = await this.prisma.contactListMember.count({ where: { listId } });
    await this.prisma.contactList.update({ where: { id: listId }, data: { count } });

    return { message: `${contactIds.length} contato(s) adicionado(s).`, count };
  }

  // ── UTILITÁRIOS ─────────────────────────────────────────

  // Normaliza para E.164: +5544999999999
  normalizePhone(raw: string): string {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');

    if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
    if (digits.length === 11) return `+55${digits}`;  // 11 dígitos BR com DDD
    if (digits.length === 10) return `+55${digits}`;  // 10 dígitos BR
    return `+${digits}`;
  }

  private parseCsv(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csv({ separator: ',', headers: true }))
        .on('data', data => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}
