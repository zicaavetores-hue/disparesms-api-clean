// src/modules/admin/admin.controller.ts
import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class GrantCreditsDto {
  @ApiProperty({ example: 1000 }) @IsNumber() amount: number;
  @ApiProperty({ example: 'Bônus de boas-vindas' }) @IsString() reason: string;
}
class SetStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] }) @IsEnum(['ACTIVE', 'SUSPENDED']) status: 'ACTIVE' | 'SUSPENDED';
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: '[Admin] Estatísticas gerais da plataforma' })
  stats(@CurrentUser() user: any) {
    return this.admin.getPlatformStats(user);
  }

  @Get('tenants')
  @ApiOperation({ summary: '[Admin] Listar todas as empresas' })
  tenants(@CurrentUser() user: any, @Query() query: any) {
    return this.admin.getTenants(user, query);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: '[Admin] Detalhe de uma empresa' })
  tenantDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.admin.getTenantDetail(user, id);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: '[Admin] Suspender ou reativar empresa' })
  setStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setTenantStatus(user, id, dto.status);
  }

  @Post('tenants/:id/credits')
  @ApiOperation({ summary: '[Admin] Adicionar créditos manualmente' })
  grantCredits(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: GrantCreditsDto) {
    return this.admin.grantCredits(user, id, dto.amount, dto.reason);
  }
}
