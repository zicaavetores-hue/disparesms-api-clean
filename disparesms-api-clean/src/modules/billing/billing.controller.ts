// src/modules/billing/billing.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class BuyCreditsDto {
  @ApiProperty({ example: 'pack_5000' }) @IsString() packageId: string;
}

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Listar planos disponíveis' })
  plans() {
    return this.billing.getPlans();
  }

  @Get('packages')
  @ApiOperation({ summary: 'Pacotes de crédito disponíveis' })
  packages() {
    return this.billing.getCreditPackages();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Saldo de créditos atual' })
  balance(@CurrentUser() user: any) {
    return this.billing.getBalance(user.tenantId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Histórico de transações de crédito' })
  transactions(@CurrentUser() user: any, @Query() query: any) {
    return this.billing.getTransactions(user.tenantId, query);
  }

  @Post('buy')
  @HttpCode(200)
  @ApiOperation({ summary: 'Comprar pacote de créditos (gera cobrança Pix)' })
  buy(@CurrentUser() user: any, @Body() dto: BuyCreditsDto) {
    return this.billing.createAsaasCharge(user.tenantId, dto.packageId);
  }
}
