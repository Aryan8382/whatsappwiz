import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessengerService } from './messenger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateMessengerUserDto,
  MarkAsReadDto,
  RegisterWebhookDto,
  SendAddressMessageDto,
  SendAudioDto,
  SendCarouselTemplateDto,
  SendCouponTemplateDto,
  SendCtaUrlDto,
  SendFlowMessageDto,
  SendFlowsTemplateDto,
  SendListMessageDto,
  SendLocationMessageDto,
  SendReplyButtonsDto,
  SendReplyDto,
  UpdateMessengerProfileDto,
} from './dto/messenger-api.dto';

/**
 * Direct pass-through wrapper around "The Messenger" API
 * (https://documenter.getpostman.com/view/34526367/2sAYX8JgH5).
 *
 * All requests are authenticated server-side using MESSENGER_API_KEY /
 * MESSENGER_WABA_ID from backend/.env — the frontend only needs a valid
 * platform JWT to call these routes.
 */
@ApiTags('Messenger API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messages/messenger')
export class MessengerController {
  constructor(private messenger: MessengerService) {}

  // ---------------- Status ----------------
  @Get('status')
  status() {
    return this.messenger.getStatus();
  }

  // ---------------- Users ----------------
  @Get('users')
  listUsers() {
    return this.messenger.listUsers();
  }

  @Post('users')
  createUser(@Body() dto: CreateMessengerUserDto) {
    return this.messenger.createUser(dto);
  }

  // ---------------- Conversations ----------------
  @Get('conversations')
  getConversations(@Query('phone_number') phoneNumber?: string) {
    return this.messenger.getConversations(phoneNumber);
  }

  // ---------------- Profile Management ----------------
  @Get('profile')
  getProfile(@Query('fields') fields?: string) {
    return this.messenger.getProfile(fields);
  }

  @Get('profile/user')
  getAccountUser() {
    return this.messenger.getAccountUser();
  }

  @Post('profile')
  updateProfile(@Body() dto: UpdateMessengerProfileDto) {
    return this.messenger.updateProfile(dto);
  }

  @Get('phone-number-details')
  getPhoneNumberDetails(@Query('fields') fields?: string) {
    return this.messenger.getPhoneNumberDetails(fields);
  }

  // ---------------- Templates ----------------
  @Get('templates')
  getTemplates(@Query('limit') limit?: string) {
    return this.messenger.getTemplates(limit ? Number(limit) : undefined);
  }

  @Get('templates/single')
  getTemplateByName(@Query('template_name') templateName: string) {
    return this.messenger.getTemplateByName(templateName);
  }

  // ---------------- Media ----------------
  @Get('media')
  getMedia(@Query('mediaId') mediaId: string) {
    return this.messenger.getMedia(mediaId);
  }

  // ---------------- Webhook ----------------
  @Get('webhook')
  getWebhookInfo() {
    return this.messenger.getWebhookInfo();
  }

  @Post('webhook')
  registerWebhook(@Body() dto: RegisterWebhookDto) {
    return this.messenger.registerWebhook(dto.url);
  }

  @Delete('webhook')
  deleteWebhook() {
    return this.messenger.deleteWebhook();
  }

  // ---------------- Read Receipts ----------------
  @Post('read-receipts')
  markAsRead(@Body() dto: MarkAsReadDto) {
    return this.messenger.markAsRead(dto.message_id);
  }

  // ---------------- Interactive session messages ----------------
  @Post('send/reply-buttons')
  sendReplyButtons(@Body() dto: SendReplyButtonsDto) {
    return this.messenger.sendReplyButtons(
      dto.to,
      dto.bodyText,
      dto.buttons,
      dto.header,
      dto.footer,
    );
  }

  @Post('send/cta-url')
  sendCtaUrlButton(@Body() dto: SendCtaUrlDto) {
    return this.messenger.sendCtaUrlButton(
      dto.to,
      dto.displayText,
      dto.url,
      dto.bodyText,
      dto.header,
      dto.footer,
    );
  }

  @Post('send/list')
  sendListMessage(@Body() dto: SendListMessageDto) {
    return this.messenger.sendListMessage(
      dto.to,
      dto.bodyText,
      dto.buttonText,
      dto.sections,
      dto.header,
      dto.footer,
    );
  }

  @Post('send/address')
  sendAddressMessage(@Body() dto: SendAddressMessageDto) {
    return this.messenger.sendAddressMessage(
      dto.to,
      dto.bodyText,
      dto.country,
      dto.name,
      dto.phoneNumber,
    );
  }

  @Post('send/location')
  sendLocationMessage(@Body() dto: SendLocationMessageDto) {
    return this.messenger.sendLocationMessage(
      dto.to,
      dto.latitude,
      dto.longitude,
      dto.name,
      dto.address,
    );
  }

  @Post('send/flow')
  sendFlowMessage(@Body() dto: SendFlowMessageDto) {
    return this.messenger.sendFlowMessage(dto.to, {
      headerText: dto.headerText,
      bodyText: dto.bodyText,
      footerText: dto.footerText,
      flowToken: dto.flowToken,
      flowId: dto.flowId,
      flowCta: dto.flowCta,
      flowAction: dto.flowAction,
      flowActionPayload: dto.flowActionPayload,
    });
  }

  @Post('send/audio')
  sendAudio(@Body() dto: SendAudioDto) {
    return this.messenger.sendAudio(dto.to, dto.audioLinkOrId);
  }

  @Post('send/reply')
  sendReply(@Body() dto: SendReplyDto) {
    return this.messenger.sendReply(
      dto.to,
      dto.contextMessageId,
      dto.text,
      dto.previewUrl,
    );
  }

  // ---------------- Advanced template sends ----------------
  @Post('send/template/carousel')
  sendCarouselTemplate(@Body() dto: SendCarouselTemplateDto) {
    return this.messenger.sendCarouselTemplate(
      dto.to,
      dto.templateName,
      dto.languageCode || 'en',
      dto.bodyParams || [],
      dto.cards,
    );
  }

  @Post('send/template/coupon')
  sendCouponTemplate(@Body() dto: SendCouponTemplateDto) {
    return this.messenger.sendCouponTemplate(
      dto.to,
      dto.templateName,
      dto.languageCode || 'en',
      dto.bodyParams || [],
      dto.couponCode,
      dto.buttonIndex ?? 0,
    );
  }

  @Post('send/template/flow')
  sendFlowsTemplate(@Body() dto: SendFlowsTemplateDto) {
    return this.messenger.sendFlowsTemplate(
      dto.to,
      dto.templateName,
      dto.languageCode || 'en',
      dto.bodyParams || [],
      dto.flowToken || 'unused',
      dto.buttonIndex || '0',
    );
  }
}
