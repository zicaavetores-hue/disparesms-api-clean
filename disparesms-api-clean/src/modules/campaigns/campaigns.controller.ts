// src/modules/campaigns/campaigns.controller.ts
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { DispatchService } from './dispatch.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SendTransactionalDto {
  @ApiProperty({ example: '+5544999999999' }) @IsString() to: string;
  @ApiProperty({ example: 'Seu código é 4821' }) @IsString() body: string;
}

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private campaigns: CampaignsService,
    private dispatch: DispatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar campanhas' })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.campaigns.findAll(user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar campanha por ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar nova campanha' })
  create(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar campanha (apenas DRAFT)' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaigns.update(user.tenantId, id, dto);
  }

  @Post(':id/launch')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disparar campanha agora' })
  launch(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.launch(user.tenantId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancelar campanha' })
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.cancel(user.tenantId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Relatório e estatísticas da campanha' })
  stats(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.getStats(user.tenantId, id);
  }

  // ── Envio transacional avulso ────────────────────────────
  @Post('send/transactional')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar SMS transacional único via API' })
  sendTransactional(@CurrentUser() user: any, @Body() dto: SendTransactionalDto) {
    return this.dispatch.sendTransactional(user.tenantId, dto.to, dto.body);
  }
}
