// src/modules/contacts/contacts.controller.ts
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateListDto } from './dto/create-list.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  // ── Contatos ───────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar contatos' })
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.contacts.findAll(user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar contato por ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.contacts.findOne(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Criar contato manualmente' })
  create(@CurrentUser() user: any, @Body() dto: CreateContactDto) {
    return this.contacts.create(user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar contato' })
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateContactDto>) {
    return this.contacts.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remover contato' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.contacts.remove(user.tenantId, id);
  }

  // ── Importação CSV ──────────────────────────────────────

  @Post('import/csv')
  @ApiOperation({ summary: 'Importar contatos via arquivo CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB
  async importCsv(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('listId') listId?: string,
  ) {
    if (!file) throw new Error('Arquivo CSV não enviado.');
    return this.contacts.importCsv(user.tenantId, file.buffer, listId);
  }

  // ── Listas ─────────────────────────────────────────────

  @Get('lists/all')
  @ApiOperation({ summary: 'Listar todas as listas de contatos' })
  getLists(@CurrentUser() user: any) {
    return this.contacts.getLists(user.tenantId);
  }

  @Post('lists')
  @ApiOperation({ summary: 'Criar nova lista de contatos' })
  createList(@CurrentUser() user: any, @Body() dto: CreateListDto) {
    return this.contacts.createList(user.tenantId, dto);
  }

  @Get('lists/:listId')
  @ApiOperation({ summary: 'Contatos de uma lista' })
  getListContacts(@CurrentUser() user: any, @Param('listId') listId: string, @Query() query: any) {
    return this.contacts.getListContacts(user.tenantId, listId, query);
  }

  @Post('lists/:listId/members')
  @ApiOperation({ summary: 'Adicionar contatos a uma lista' })
  addToList(@CurrentUser() user: any, @Param('listId') listId: string, @Body() body: { contactIds: string[] }) {
    return this.contacts.addContactsToList(user.tenantId, listId, body.contactIds);
  }
}
