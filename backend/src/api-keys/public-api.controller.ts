import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from './api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from '../messages/messages.service';
import { ContactsService } from '../contacts/contacts.service';
import { SendMediaDto, SendTemplateDto, SendTextDto } from '../messages/dto/send-message.dto';
import { CreateContactDto } from '../contacts/dto/contact.dto';

/**
 * Developer-facing REST API authenticated with X-Api-Key header.
 */
@ApiTags('Public API (API Key)')
@UseGuards(ApiKeyGuard)
@Controller('api')
export class PublicApiController {
  constructor(
    private messages: MessagesService,
    private contactsService: ContactsService,
  ) {}

  @Post('messages/send')
  sendMessage(@CurrentUser() user: any, @Body() dto: SendTextDto) {
    return this.messages.sendText(user.organizationId, user.sub, dto);
  }

  @Post('messages/template')
  sendTemplate(@CurrentUser() user: any, @Body() dto: SendTemplateDto) {
    return this.messages.sendTemplate(user.organizationId, user.sub, dto);
  }

  @Post('messages/media')
  sendMedia(@CurrentUser() user: any, @Body() dto: SendMediaDto) {
    return this.messages.sendMedia(user.organizationId, user.sub, dto);
  }

  @Get('messages/:id')
  messageStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.messages.getStatus(+id, user.organizationId);
  }

  @Get('contacts')
  contacts(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.contactsService.list(user.organizationId, +page, +limit, search);
  }

  @Post('contacts')
  createContact(@CurrentUser() user: any, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.organizationId, dto);
  }

  @Get('contacts/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=contacts.csv')
  exportContacts(@CurrentUser() user: any) {
    return this.contactsService.export(user.organizationId);
  }
}
