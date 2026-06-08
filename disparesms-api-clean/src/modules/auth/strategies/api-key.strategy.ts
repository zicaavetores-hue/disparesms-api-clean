// src/modules/auth/strategies/api-key.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { PrismaService } from '../../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
  constructor(private prisma: PrismaService) {
    super({ header: 'x-api-key', prefix: '' }, true);
  }

  async validate(apiKey: string, done: (err: Error | null, user?: any) => void) {
    // Busca todas as keys ativas e verifica com bcrypt
    // Em produção, guarde um hash para comparação rápida
    const prefix = apiKey.substring(0, 16);
    const keys = await this.prisma.apiKey.findMany({
      where: { keyPrefix: prefix, isActive: true },
      include: { tenant: { include: { plan: true } } },
    });

    for (const key of keys) {
      const valid = await bcrypt.compare(apiKey, key.keyHash);
      if (valid) {
        await this.prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        });
        return done(null, { apiKey: key, tenant: key.tenant });
      }
    }

    done(new UnauthorizedException('API Key inválida.'));
  }
}
