import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { WalletService } from '../wallet/wallet.service';
import { MockWhatsappService } from './mock-whatsapp.service';
import { MessengerService } from './messenger.service';
import { WebhookReceiverService } from './webhook-receiver.service';
import { SendMediaDto, SendTemplateDto, SendTextDto } from './dto/send-message.dto';
import { BotEngineService } from './bot-engine.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
    private wallet: WalletService,
    private mockWhatsapp: MockWhatsappService,
    private messenger: MessengerService,
    private webhookReceiver: WebhookReceiverService,
    private botEngine: BotEngineService,
    private config: ConfigService,
  ) {}

  async sendText(organizationId: number, userId: number, dto: SendTextDto) {
    const number = await this.getOwnedNumber(organizationId, dto.whatsappNumberId);
    const contact = await this.getOrCreateContact(organizationId, dto.to);
    const conversation = await this.getOrCreateConversation(
      organizationId,
      contact.id,
      number.id,
    );
    const cost = Number(this.config.get('COST_TEXT') || '0.10');
    return this.dispatchMessage({
      organizationId,
      userId,
      conversation,
      number,
      senderType: 'agent',
      messageType: 'text',
      text: dto.text,
      cost,
      metaRef: `text-${Date.now()}`,
      description: `Text message to ${dto.to}`,
    });
  }

  async sendTemplate(organizationId: number, userId: number, dto: SendTemplateDto) {
    const number = await this.getOwnedNumber(organizationId, dto.whatsappNumberId);
    const template = await this.prisma.template.findFirst({
      where: {
        organizationId: BigInt(organizationId),
        name: dto.templateName,
        status: 'approved',
      },
    });
    if (!template) {
      throw new BadRequestException(
        `Approved template "${dto.templateName}" not found`,
      );
    }
    const contact = await this.getOrCreateContact(organizationId, dto.to);
    const conversation = await this.getOrCreateConversation(
      organizationId,
      contact.id,
      number.id,
    );
    const params = dto.parameters || [];
    let body = template.body || '';
    for (let i = 0; i < params.length; i++) {
      body = body.split(`{{${i + 1}}}`).join(params[i]);
    }
    const templateComponents: any[] = [];
    if (params.length > 0) {
      templateComponents.push({
        type: 'body',
        parameters: params.map((p: string) => ({ type: 'text', text: p })),
      });
    }
    const cost = Number(this.config.get('COST_TEMPLATE') || '0.30');
    return this.dispatchMessage({
      organizationId,
      userId,
      conversation,
      number,
      senderType: 'agent',
      messageType: 'template',
      text: body,
      templateName: template.name,
      templateLanguage: template.language || dto.language || 'en_GB',
      templateComponents,
      cost,
      metaRef: `tpl-${Date.now()}`,
      description: `Template "${template.name}" to ${dto.to}`,
    });
  }

  async sendMedia(organizationId: number, userId: number, dto: SendMediaDto) {
    const number = await this.getOwnedNumber(organizationId, dto.whatsappNumberId);
    const contact = await this.getOrCreateContact(organizationId, dto.to);
    const conversation = await this.getOrCreateConversation(
      organizationId,
      contact.id,
      number.id,
    );
    const cost = Number(this.config.get('COST_MEDIA') || '0.20');
    const mediaUrl = dto.mediaUrl || (await this.mockWhatsapp.uploadMedia());
    return this.dispatchMessage({
      organizationId,
      userId,
      conversation,
      number,
      senderType: 'agent',
      messageType: dto.type || 'image',
      text: dto.caption || null,
      mediaUrl,
      cost,
      metaRef: `media-${Date.now()}`,
      description: `${dto.type || 'media'} message to ${dto.to}`,
    });
  }

  async sendBotMessage(
    organizationId: number,
    conversationId: number,
    text: string,
    senderType: 'bot',
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
      include: { contact: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const number = conversation.whatsappNumberId
      ? await this.prisma.whatsappNumber.findUnique({
          where: { id: conversation.whatsappNumberId },
        })
      : null;
    const cost = Number(this.config.get('COST_TEXT') || '0.10');
    await this.wallet.debit(
      organizationId,
      cost,
      'debit',
      `bot-${Date.now()}`,
      `Bot reply to conversation ${conversationId}`,
    );

    // Call real Messenger API
    const recipientPhone = conversation.contact.mobile;
    this.logger.log(
      `Recipient Resolution (bot): contact database ID: ${conversation.contact.id}, contact.mobile: ${conversation.contact.mobile}, final recipient: ${recipientPhone}`,
    );
    const result = await this.messenger.sendText(recipientPhone, text);

    const message = await this.prisma.message.create({
      data: {
        organizationId: BigInt(organizationId),
        conversationId: conversation.id,
        whatsappNumberId: number?.id || null,
        senderType,
        messageType: 'text',
        messageText: text,
        metaMessageId: result.metaMessageId,
        status: result.status === 'failed' ? 'failed' : 'sent',
        sentAt: new Date(),
      },
    });
    this.realtime.emitToOrg(organizationId, 'message:new', message);
    if (result.status === 'failed') {
      this.realtime.emitToOrg(organizationId, 'message:status', {
        conversationId,
        messageId: Number(message.id),
        status: 'failed',
      });
      return message;
    }
    this.scheduleStatus(organizationId, result.metaMessageId);
    return message;
  }

  private async dispatchMessage(params: {
    organizationId: number;
    userId: number;
    conversation: any;
    number: any;
    senderType: string;
    messageType: string;
    text?: string | null;
    mediaUrl?: string;
    templateName?: string;
    templateLanguage?: string;
    templateComponents?: any[];
    cost: number;
    metaRef: string;
    description: string;
  }) {
    await this.wallet.debit(
      params.organizationId,
      params.cost,
      'debit',
      params.metaRef,
      params.description,
    );

    const recipientPhone = params.conversation.contact.mobile;
    this.logger.log(
      `Recipient Resolution: contact database ID: ${params.conversation.contact?.id}, contact.mobile: ${params.conversation.contact?.mobile}, final recipient: ${recipientPhone}`,
    );
    let result: { metaMessageId: string; status: string };

    if (params.messageType === 'template') {
      const components: any[] = params.templateComponents || [];
      result = await this.messenger.sendTemplate(
        recipientPhone,
        params.templateName || '',
        params.templateLanguage || 'en_GB',
        components,
      );
    } else if (['image', 'video', 'document'].includes(params.messageType) && params.mediaUrl) {
      if (params.messageType === 'image') {
        result = await this.messenger.sendImage(recipientPhone, params.mediaUrl, params.text || undefined);
      } else if (params.messageType === 'video') {
        result = await this.messenger.sendVideo(recipientPhone, params.mediaUrl, params.text || undefined);
      } else {
        result = await this.messenger.sendDocument(recipientPhone, params.mediaUrl, undefined, params.text || undefined);
      }
    } else {
      result = await this.messenger.sendText(recipientPhone, params.text || '');
    }

    const message = await this.prisma.message.create({
      data: {
        organizationId: BigInt(params.organizationId),
        conversationId: params.conversation.id,
        whatsappNumberId: params.number.id,
        senderType: params.senderType,
        senderId: BigInt(params.userId),
        messageType: params.messageType,
        messageText: params.text || null,
        mediaUrl: params.mediaUrl || null,
        metaMessageId: result.metaMessageId,
        status: result.status === 'failed' ? 'failed' : 'sent',
        sentAt: new Date(),
      },
      include: { conversation: { include: { contact: true } } },
    });

    this.realtime.emitToOrg(params.organizationId, 'message:new', message);
    this.webhooks.dispatch(params.organizationId, 'message.sent', message);

    if (result.status === 'failed') {
      this.realtime.emitToOrg(params.organizationId, 'message:status', {
        conversationId: Number(params.conversation.id),
        messageId: Number(message.id),
        status: 'failed',
      });
      this.webhooks.dispatch(params.organizationId, 'message.failed', message);
      throw new BadRequestException(
        (result as any).error
          ? `Messenger API Error: ${(result as any).error}`
          : 'Failed to send message via Messenger API',
      );
    }

    this.scheduleStatus(params.organizationId, result.metaMessageId);
    return message;
  }

  private scheduleStatus(organizationId: number, metaMessageId: string) {
    setTimeout(() => {
      this.webhookReceiver.processStatus(organizationId, metaMessageId, 'delivered');
    }, 1500);
    if (Math.random() < 0.75) {
      setTimeout(() => {
        this.webhookReceiver.processStatus(organizationId, metaMessageId, 'read');
      }, 4000);
    }
  }

  async conversationMessages(conversationId: number, organizationId: number) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async runBotReply(
    organizationId: number,
    conversationId: number,
    text: string,
    botId?: number,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(conversationId), organizationId: BigInt(organizationId) },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const messages = await this.botEngine.handleIncoming(
      organizationId,
      conversationId,
      text,
      botId,
    );
    return { items: Array.isArray(messages) ? messages : [] };
  }

  async getStatus(messageId: number, organizationId: number) {
    const message = await this.prisma.message.findFirst({
      where: { id: BigInt(messageId), organizationId: BigInt(organizationId) },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  // New method to send a test message directly via MessengerService without DB interactions
  async sendTestMessage(phone: string, text: string) {
    // Directly use messenger service to send a text message
    return this.messenger.sendText(phone, text);
  }

  async getMessengerStatus() {
    return this.messenger.getStatus();
  }

  async retry(messageId: number, organizationId: number, userId: number) {
    const message = await this.prisma.message.findFirst({
      where: { id: BigInt(messageId), organizationId: BigInt(organizationId) },
      include: { conversation: { include: { contact: true } } },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.status !== 'failed') {
      throw new BadRequestException('Only failed messages can be retried');
    }
    const number = message.whatsappNumberId
      ? await this.prisma.whatsappNumber.findUnique({
          where: { id: message.whatsappNumberId },
        })
      : null;
    if (!number) throw new NotFoundException('WhatsApp number not found');
    await this.dispatchMessage({
      organizationId,
      userId,
      conversation: message.conversation,
      number,
      senderType: 'agent',
      messageType: message.messageType,
      text: message.messageText,
      cost: Number(this.config.get('COST_TEXT') || '0.10'),
      metaRef: `retry-${Date.now()}`,
      description: `Retry of message ${messageId}`,
    });
    return { success: true };
  }

  private async getOwnedNumber(organizationId: number, whatsappNumberId: number) {
    const number = await this.prisma.whatsappNumber.findFirst({
      where: {
        id: BigInt(whatsappNumberId),
        organizationId: BigInt(organizationId),
      },
    });
    if (!number) throw new NotFoundException('WhatsApp number not found for this organization');
    return number;
  }

  private async getOrCreateContact(organizationId: number, mobile: string) {
    let contact = await this.prisma.contact.findFirst({
      where: { organizationId: BigInt(organizationId), mobile },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          organizationId: BigInt(organizationId),
          firstName: mobile,
          mobile,
          source: 'manual-send',
        },
      });
    }
    return contact;
  }

  private async getOrCreateConversation(
    organizationId: number,
    contactId: bigint,
    whatsappNumberId: bigint,
  ) {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId: BigInt(organizationId),
        contactId,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: { contact: true },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId: BigInt(organizationId),
          contactId,
          whatsappNumberId,
          status: 'open',
          channel: 'whatsapp',
        },
        include: { contact: true },
      });
    }
    return conversation;
  }
}
