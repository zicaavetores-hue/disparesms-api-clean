// src/modules/auth/auth.service.ts
import {
  Injectable, UnauthorizedException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── Registro de nova empresa ────────────────────────────
  async register(dto: RegisterDto) {
    // Verifica se e-mail já existe
    const existing = await this.prisma.tenant.findUnique({ where: { email: dto.companyEmail } });
    if (existing) throw new ConflictException('Este e-mail já está cadastrado.');

    // Gera slug único a partir do nome da empresa
    const slug = await this.generateSlug(dto.companyName);

    // Busca plano starter
    const plan = await this.prisma.plan.findUnique({ where: { slug: 'starter' } });

    // Cria tenant (empresa) + usuário owner em uma transação
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug,
          email: dto.companyEmail,
          phone: dto.phone,
          planId: plan.id,
          creditsBalance: 200, // 200 SMS grátis de boas-vindas
        },
      });

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email: dto.companyEmail,
          passwordHash,
          role: 'OWNER',
        },
      });

      // Registra os 200 créditos grátis
      await tx.creditTransaction.create({
        data: {
          tenantId: tenant.id,
          type: 'PLAN_GRANT',
          amount: 200,
          balance: 200,
          description: 'Bônus de boas-vindas — 200 SMS grátis',
        },
      });

      return { tenant, user };
    });

    return this.generateTokens(result.user, result.tenant);
  }

  // ── Login ────────────────────────────────────────────────
  async login(dto: LoginDto) {
    // Busca usuário pelo e-mail
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: { tenant: { include: { plan: true } } },
    });

    if (!user) throw new UnauthorizedException('E-mail ou senha incorretos.');
    if (user.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException('Conta suspensa. Entre em contato com o suporte.');
    }

    // Verifica senha
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('E-mail ou senha incorretos.');

    // Atualiza último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user, user.tenant);
  }

  // ── Validar usuário (usado pelo LocalStrategy) ────────────
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
      include: { tenant: true },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  // ── Gera tokens JWT ──────────────────────────────────────
  generateTokens(user: any, tenant: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan?.name,
        creditsBalance: tenant.creditsBalance,
      },
    };
  }

  // ── Gera slug único ──────────────────────────────────────
  private async generateSlug(name: string): Promise<string> {
    let slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let suffix = '';
    let attempts = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug: slug + suffix } })) {
      suffix = `-${++attempts}`;
    }
    return slug + suffix;
  }

  // ── Perfil do usuário logado ─────────────────────────────
  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        tenant: {
          select: {
            id: true, name: true, slug: true, creditsBalance: true, smsSentMonth: true,
            plan: { select: { name: true, smsLimit: true, features: true } },
          },
        },
      },
    });
  }
}
