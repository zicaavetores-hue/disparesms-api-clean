// src/modules/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ─────────────────────────────────────────────
// src/modules/auth/guards/api-key.guard.ts
// (embutido aqui por simplicidade)
// ─────────────────────────────────────────────
import { Injectable as Inj } from '@nestjs/common';
import { AuthGuard as AG } from '@nestjs/passport';

@Inj()
export class ApiKeyGuard extends AG('api-key') {}
