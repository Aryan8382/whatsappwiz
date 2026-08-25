import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto, CreateTagDto, UpdateContactDto } from './dto/contact.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.contacts.list(user.organizationId, +page, +limit, search, tag);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateContactDto) {
    return this.contacts.create(user.organizationId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(user.organizationId, +id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.contacts.remove(user.organizationId, +id);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
  ) {
    if (!file) return { error: 'No file uploaded' };
    return this.contacts.importCsv(user.organizationId, file.buffer);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=contacts.csv')
  export(@CurrentUser() user: any) {
    return this.contacts.export(user.organizationId);
  }

  @Get('tags')
  tags(@CurrentUser() user: any) {
    return this.contacts.tags(user.organizationId);
  }

  @Get('tags/:id/contacts')
  getTagContacts(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.contacts.getTagContacts(user.organizationId, +id, +page, +limit, search);
  }

  @Delete('tags/:tagId/contacts/:contactId')
  removeContactFromTag(
    @CurrentUser() user: any,
    @Param('tagId') tagId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contacts.removeContactFromTag(user.organizationId, +tagId, +contactId);
  }

  @Post('tags')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  createTag(@CurrentUser() user: any, @Body() dto: CreateTagDto) {
    return this.contacts.createTag(user.organizationId, dto.name, dto.color);
  }

  @Delete('tags/:id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  deleteTag(@CurrentUser() user: any, @Param('id') id: string) {
    return this.contacts.deleteTag(user.organizationId, +id);
  }
}
