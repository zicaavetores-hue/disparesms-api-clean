// src/modules/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IsEmail, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';

class InviteUserDto {
  @ApiProperty({ example: 'Maria Silva' }) @IsString() name: string;
  @ApiProperty({ example: 'maria@empresa.com' }) @IsEmail() email: string;
  @ApiProperty({ enum: ['ADMIN', 'MEMBER'] }) @IsEnum(['ADMIN', 'MEMBER']) role: 'ADMIN' | 'MEMBER';
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários da empresa' })
  async findAll(@CurrentUser() user: any) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
    });
  }

  @Post('invite')
  @ApiOperation({ summary: 'Convidar novo membro da equipe' })
  async invite(@CurrentUser() user: any, @Body() dto: InviteUserDto) {
    const tempPassword = Math.random().toString(36).slice(-10) + '@Tmp1';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const newUser = await this.prisma.user.create({
      data: {
        tenantId: user.tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
    });

    return {
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      tempPassword,
      message: 'Usuário criado. Envie a senha temporária para ele trocar no primeiro acesso.',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover usuário da equipe' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    await this.prisma.user.updateMany({
      where: { id, tenantId: user.tenantId, role: { not: 'OWNER' } },
      data: { isActive: false },
    });
    return { message: 'Usuário removido.' };
  }
}
