import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessengerService } from './messenger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Messenger API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('messenger')
export class MessengerController {
  constructor(private readonly messenger: MessengerService) {}

  @Get('status')
  getStatus() {
    return this.messenger.getStatus();
  }

  // ==========================================
  // USERS
  // ==========================================
  @Get('users')
  listUsers(@Query('user_type') userType?: string) {
    return this.messenger.listUsers(userType);
  }

  @Post('users/business')
  createBusiness(
    @Body()
    body: {
      name: string;
      email: string;
      company_name: string;
      phone?: string;
      webhook_forwarding_url?: string;
    },
  ) {
    return this.messenger.createBusinessUser(body);
  }

  @Post('users/waba')
  createWabaUser(
    @Body()
    body: {
      name: string;
      email: string;
      currencies?: string;
      phone: string;
      webhook_forwarding_url?: string;
    },
  ) {
    return this.messenger.createWabaUser(body);
  }

  // ==========================================
  // CONVERSATIONS
  // ==========================================
  @Get('conversations')
  getConversations(
    @Query('phone_number') phoneNumber?: string,
    @Query('page') page?: string,
  ) {
    return this.messenger.getConversations(
      phoneNumber,
      page ? parseInt(page, 10) : undefined,
    );
  }

  // ==========================================
  // TEMPLATES
  // ==========================================
  @Get('templates')
  getTemplates(@Query('limit') limit?: string) {
    return this.messenger.getTemplates(limit ? parseInt(limit, 10) : 1000);
  }

  // ==========================================
  // SEND APIS
  // ==========================================
  @Post('send/text')
  sendText(@Body() body: { to: string; text: string }) {
    return this.messenger.sendText(body.to, body.text);
  }

  @Post('send/image')
  sendImage(@Body() body: { to: string; imageUrl: string; caption?: string }) {
    return this.messenger.sendImage(body.to, body.imageUrl, body.caption);
  }

  @Post('send/video')
  sendVideo(@Body() body: { to: string; videoUrl: string; caption?: string }) {
    return this.messenger.sendVideo(body.to, body.videoUrl, body.caption);
  }

  @Post('send/document')
  sendDocument(
    @Body()
    body: {
      to: string;
      documentUrl: string;
      filename?: string;
      caption?: string;
    },
  ) {
    return this.messenger.sendDocument(
      body.to,
      body.documentUrl,
      body.filename,
      body.caption,
    );
  }

  @Post('send/audio')
  sendAudio(@Body() body: { to: string; audioUrl: string }) {
    return this.messenger.sendAudio(body.to, body.audioUrl);
  }

  @Post('send/location')
  sendLocation(
    @Body()
    body: {
      to: string;
      location: {
        longitude: number;
        latitude: number;
        name?: string;
        address?: string;
      };
    },
  ) {
    return this.messenger.sendLocation(body.to, body.location);
  }

  @Post('send/template')
  sendTemplate(
    @Body()
    body: {
      to: string;
      templateName: string;
      languageCode?: string;
      components?: any[];
    },
  ) {
    return this.messenger.sendTemplate(
      body.to,
      body.templateName,
      body.languageCode || 'en',
      body.components || [],
    );
  }

  @Post('send/interactive-buttons')
  sendInteractiveButtons(
    @Body()
    body: {
      to: string;
      text: string;
      buttons: Array<{ id: string; title: string }>;
    },
  ) {
    return this.messenger.sendInteractiveButtons(
      body.to,
      body.text,
      body.buttons,
    );
  }

  @Post('send/interactive-cta')
  sendInteractiveCta(
    @Body()
    body: {
      to: string;
      bodyText: string;
      displayText: string;
      url: string;
      headerText?: string;
      footerText?: string;
    },
  ) {
    return this.messenger.sendInteractiveCtaUrl(
      body.to,
      body.bodyText,
      body.displayText,
      body.url,
      body.headerText,
      body.footerText,
    );
  }

  @Post('send/interactive-list')
  sendInteractiveList(
    @Body()
    body: {
      to: string;
      bodyText: string;
      buttonText: string;
      sections: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
      headerText?: string;
      footerText?: string;
    },
  ) {
    return this.messenger.sendInteractiveList(
      body.to,
      body.bodyText,
      body.buttonText,
      body.sections,
      body.headerText,
      body.footerText,
    );
  }

  @Post('send/interactive-address')
  sendInteractiveAddress(
    @Body()
    body: {
      to: string;
      bodyText: string;
      country: 'IN' | 'SG';
      customerName: string;
      phoneNumber: string;
    },
  ) {
    return this.messenger.sendInteractiveAddress(
      body.to,
      body.bodyText,
      body.country,
      body.customerName,
      body.phoneNumber,
    );
  }

  @Post('send/interactive-flow')
  sendInteractiveFlow(
    @Body()
    body: {
      to: string;
      flowId: string;
      flowCta: string;
      flowToken?: string;
      flowAction?: string;
      screen?: string;
      header?: string;
      body: string;
      footer?: string;
    },
  ) {
    return this.messenger.sendInteractiveFlow(body.to, body);
  }

  // ==========================================
  // MEDIA
  // ==========================================
  @Get('media/:mediaId')
  getMedia(@Param('mediaId') mediaId: string) {
    return this.messenger.getMedia(mediaId);
  }

  // ==========================================
  // WEBHOOKS
  // ==========================================
  @Get('webhook')
  getWebhookInfo() {
    return this.messenger.getWebhookInfo();
  }

  @Post('webhook')
  registerWebhook(@Body('url') url: string) {
    return this.messenger.registerWebhook(url);
  }

  @Delete('webhook')
  deleteWebhook() {
    return this.messenger.deleteWebhook();
  }
}
