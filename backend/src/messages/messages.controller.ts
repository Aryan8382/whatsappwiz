import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { RunBotReplyDto, SendMediaDto, SendTemplateDto, SendTextDto } from './dto/send-message.dto';
import { TestMessageDto } from './dto/test-message.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Post('send')
  sendText(@CurrentUser() user: any, @Body() dto: SendTextDto) {
    return this.messages.sendText(user.organizationId, user.sub, dto);
  }

  @Post('template')
  sendTemplate(@CurrentUser() user: any, @Body() dto: SendTemplateDto) {
    return this.messages.sendTemplate(user.organizationId, user.sub, dto);
  }

  @Post('media')
  sendMedia(@CurrentUser() user: any, @Body() dto: SendMediaDto) {
    return this.messages.sendMedia(user.organizationId, user.sub, dto);
  }

  @Get('conversation/:conversationId')
  conversationMessages(@CurrentUser() user: any, @Param('conversationId') conversationId: string) {
    return this.messages.conversationMessages(+conversationId, user.organizationId);
  }

  @Post('conversation/:conversationId/bot-reply')
  runBotReply(@CurrentUser() user: any, @Param('conversationId') conversationId: string, @Body() dto: RunBotReplyDto) {
    return this.messages.runBotReply(user.organizationId, +conversationId, dto.text, dto.botId);
  }

  @Get(':id')
  getStatus(@CurrentUser() user: any, @Param('id') id: string) {
    return this.messages.getStatus(+id, user.organizationId);
  }

  @Post(':id/retry')
  retry(@CurrentUser() user: any, @Param('id') id: string) {
    return this.messages.retry(+id, user.organizationId, user.sub);
  }

  @Get('messenger/status')
  async messengerStatus(@CurrentUser() user: any) {
    return this.messages.getMessengerStatus();
  }

  @Post('test')
  async testMessage(@Body() dto: TestMessageDto) {
    return this.messages.sendTestMessage(dto.phone, dto.text);
  }
  @Get('test/:phone/:text')
  async testMessageViaGet(@Param('phone') phone: string, @Param('text') text: string) {
    return this.messages.sendTestMessage(phone, decodeURIComponent(text));
  }
}

