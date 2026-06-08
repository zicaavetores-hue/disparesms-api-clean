// src/modules/tenants/tenants.controller.ts
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateTenantDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() document?: string;
}

@ApiTags('Tenant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Dados da empresa atual' })
  async getMyTenant(@CurrentUser() user: any) {
    return this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { plan: true, _count: { select: { contacts: true, campaigns: true, messages: true } } },
    });
  }

  @Put()
  @ApiOperation({ summary: 'Atualizar dados da empresa' })
  async updateTenant(@CurrentUser() user: any, @Body() dto: UpdateTenantDto) {
    return this.prisma.tenant.update({ where: { id: user.tenantId }, data: dto });
  }

  // Gestão de API Keys
  @Get('api-keys')
  @ApiOperation({ summary: 'Listar API Keys' })
  async getApiKeys(@CurrentUser() user: any) {
    return this.prisma.apiKey.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    });
  }

  @Put('api-keys/:id/revoke')
  @ApiOperation({ summary: 'Revogar API Key' })
  async revokeApiKey(@CurrentUser() user: any, @Body() body: { id: string }) {
    return this.prisma.apiKey.updateMany({
      where: { id: body.id, tenantId: user.tenantId },
      data: { isActive: false },
    });
  }
}
