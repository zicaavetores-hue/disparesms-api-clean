// src/modules/messages/messages.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Histórico de mensagens enviadas' })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.messages.findAll(user.tenantId, query);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Métricas do dashboard' })
  dashboard(@CurrentUser() user: any) {
    return this.messages.getDashboardStats(user.tenantId);
  }
}
