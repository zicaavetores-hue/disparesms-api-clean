// src/modules/contacts/dto/create-list.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateListDto {
  @ApiProperty({ example: 'Clientes VIP' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Lista de clientes com alto LTV', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
