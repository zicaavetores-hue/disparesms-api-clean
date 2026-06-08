// src/modules/contacts/dto/create-contact.dto.ts
import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ example: '+5544999999999' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'João Silva', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'joao@email.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: ['cliente', 'vip'], required: false })
  @IsOptional()
  @IsArray()
  tags?: string[];
}
