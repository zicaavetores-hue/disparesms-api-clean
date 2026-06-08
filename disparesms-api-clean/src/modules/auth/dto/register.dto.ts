// src/modules/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Fruitfy Pagamentos' })
  @IsString()
  companyName: string;

  @ApiProperty({ example: 'contato@fruitfy.com.br' })
  @IsEmail()
  companyEmail: string;

  @ApiProperty({ example: '(44) 99144-5556' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'SenhaForte@2025', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
