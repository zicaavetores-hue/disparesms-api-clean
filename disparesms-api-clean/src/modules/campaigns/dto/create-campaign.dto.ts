// src/modules/campaigns/dto/create-campaign.dto.ts
import { IsString, IsOptional, IsArray, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Promoção Dia das Mães' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Olá {{nome}}! Temos 20% OFF para você hoje. Use: MAIO20 👉 link.com/promo' })
  @IsString()
  messageBody: string;

  @ApiProperty({ example: ['uuid-lista-1', 'uuid-lista-2'] })
  @IsOptional()
  @IsArray()
  listIds?: string[];

  @ApiProperty({ example: 'MARKETING', enum: ['MARKETING', 'TRANSACTIONAL', 'RECOVERY'] })
  @IsOptional()
  @IsEnum(['MARKETING', 'TRANSACTIONAL', 'RECOVERY'])
  type?: string;

  @ApiProperty({ example: '2025-06-10T09:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
