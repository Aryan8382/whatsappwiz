import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiverService } from './webhook-receiver.service';
import { MessengerService } from './messenger.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('WhatsApp Webhooks')
@Controller('webhooks')
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);

  constructor(
    private receiver: WebhookReceiverService,
    private messenger: MessengerService,
    private config: ConfigService,
  ) {}

  /**
   * Meta & Messenger Webhook Verification (GET /webhooks/messenger and GET /webhooks/meta)
   */
  @Public()
  @Get('messenger')
  verifyMessenger(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    return this.handleVerify(mode, verifyToken, challenge, res);
  }

  @Public()
  @Get('meta')
  verifyMeta(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: any,
  ) {
    return this.handleVerify(mode, verifyToken, challenge, res);
  }

  private handleVerify(
    mode: string,
    verifyToken: string,
    challenge: string,
    res: any,
  ) {
    const expected =
      this.config.get('MESSENGER_WEBHOOK_VERIFY_TOKEN') ||
      this.config.get('META_WEBHOOK_VERIFY_TOKEN') ||
      'wiz_meta_webhook_verify';

    if (mode === 'subscribe' && verifyToken === expected) {
      this.logger.log('Webhook verification successful');
      return res.status(200).send(challenge);
    }
    this.logger.warn(`Webhook verification failed. Token received: ${verifyToken}`);
    return res.status(403).send('Verification failed');
  }

  /**
   * Meta & Messenger Webhook Events (POST /webhooks/messenger and POST /webhooks/meta)
   */
  @Public()
  @Post('messenger')
  receiveMessenger(@Body() payload: any) {
    return this.handleReceive(payload);
  }

  @Public()
  @Post('meta')
  receiveMeta(@Body() payload: any) {
    return this.handleReceive(payload);
  }

  private async handleReceive(payload: any) {
    // Requirement 5: Log raw webhook payload during development
    this.logger.log(`Raw Webhook Payload: ${JSON.stringify(payload)}`);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    const entries = Array.isArray(payload.entry) ? payload.entry : [payload];
    const results: any[] = [];
    const errors: Array<{ phoneNumberId: string; error: string }> = [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [entry];

      for (const change of changes) {
        const value = change.value || change || {};
        const phoneNumberId =
          value.metadata?.phone_number_id || value.metadata?.phoneNumberId || '';

        // Each change is isolated: an unregistered/misconfigured phone_number_id
        // for one change must not prevent other valid changes in the same
        // batched payload from being processed and saved.
        let organizationId: number;
        try {
          organizationId =
            await this.receiver.resolveOrganizationIdForWhatsappNumber(phoneNumberId);
        } catch (err: any) {
          this.logger.error(
            `Skipping webhook change for phone_number_id=${phoneNumberId}: ${err.message}`,
          );
          errors.push({ phoneNumberId, error: err.message });
          continue;
        }

        try {
          // Process message statuses (sent, delivered, read, failed)
          for (const status of value.statuses || []) {
            const timestamp = status.timestamp
              ? new Date(Number(status.timestamp) * 1000)
              : new Date();
            await this.receiver.processStatus(
              organizationId,
              status.id,
              status.status,
              timestamp,
            );
          }

          // Process incoming WhatsApp customer messages
          for (const msg of value.messages || []) {
            const msgType = msg.type || 'text';
            let text = msg?.text?.body || '';
            let mediaUrl: string | undefined;

            if (msgType === 'image') {
              text = msg.image?.caption || 'Image message';
              mediaUrl = msg.image?.link || msg.image?.url || msg.image?.id;
            } else if (msgType === 'video') {
              text = msg.video?.caption || 'Video message';
              mediaUrl = msg.video?.link || msg.video?.url || msg.video?.id;
            } else if (msgType === 'document') {
              text = msg.document?.caption || msg.document?.filename || 'Document message';
              mediaUrl = msg.document?.link || msg.document?.url || msg.document?.id;
            } else if (msgType === 'interactive') {
              text =
                msg.interactive?.button_reply?.title ||
                msg.interactive?.list_reply?.title ||
                msg.interactive?.nfm_reply?.response_json ||
                'Interactive response';
            }

            const savedMessage = await this.receiver.processIncomingMessage({
              organizationId,
              whatsappNumberId: phoneNumberId,
              from: msg.from || '',
              messageType: msgType,
              text,
              mediaUrl,
              metaMessageId: msg.id,
            });

            results.push(savedMessage);
          }
        } catch (err: any) {
          // A failure processing one change (e.g. a malformed message) should
          // not abort the rest of the batch either.
          this.logger.error(
            `Error processing webhook change for phone_number_id=${phoneNumberId}: ${err.message}`,
          );
          errors.push({ phoneNumberId, error: err.message });
        }
      }
    }

    return { success: errors.length === 0, resultsCount: results.length, errors };
  }

  /**
   * Simulate Incoming Message (POST /webhooks/messenger/simulate-incoming)
   */
  @Public()
  @Post('messenger/simulate-incoming')
  @Post('meta/simulate-incoming')
  async simulateIncoming(@Body() body: any) {
    if (!body.from) {
      throw new BadRequestException('from is required');
    }
    const phoneNumberId = body.phoneNumberId || 'PHONE-001';
    const organizationId =
      await this.receiver.resolveOrganizationIdForWhatsappNumber(phoneNumberId);

    const message = await this.receiver.processIncomingMessage({
      organizationId,
      whatsappNumberId: phoneNumberId,
      from: body.from,
      messageType: body.type || 'text',
      text: body.text || 'Hello',
      mediaUrl: body.mediaUrl,
      metaMessageId: body.metaMessageId || `wamid.simulated.${Date.now()}`,
    });

    return { success: true, message };
  }

  /**
   * Requirement 13: Webhook Registration Endpoints
   */
  @Public()
  @Post('register')
  async registerWebhook(@Body() body: { url: string }) {
    if (!body.url) {
      throw new BadRequestException('url is required');
    }
    return this.messenger.registerWebhook(body.url);
  }

  @Public()
  @Get('inspect')
  async inspectWebhook() {
    return this.messenger.getWebhookInfo();
  }

  @Public()
  @Delete('unregister')
  async unregisterWebhook() {
    return this.messenger.deleteWebhook();
  }
}