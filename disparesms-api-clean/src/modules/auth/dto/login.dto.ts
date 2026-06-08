// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dev@fruitfy.com.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Fruitfy@2025!' })
  @IsString()
  password: string;
}
