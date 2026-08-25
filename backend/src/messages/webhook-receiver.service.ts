import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { BotEngineService } from './bot-engine.service';

@Injectable()
export class WebhookReceiverService {
  private readonly logger = new Logger(WebhookReceiverService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
    private botEngine: BotEngineService,
  ) {}

  async processStatus(
    organizationId: number,
    metaMessageId: string,
    status: string,
    timestamp: Date = new Date(),
  ) {
    const message = await this.prisma.message.findFirst({
      where: {
        organizationId: BigInt(organizationId),
        metaMessageId,
      },
    });
    if (!message || message.status === status) return;

    const data: any = { status };
    if (status === 'delivered') data.deliveredAt = timestamp;
    if (status === 'read') data.readAt = timestamp;

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data,
    });

    this.realtime.emitToOrg(organizationId, 'message:status', {
      conversationId: Number(message.conversationId),
      messageId: Number(message.id),
      status,
    });

    const eventMap: Record<string, string> = {
      delivered: 'message.delivered',
      read: 'message.read',
      failed: 'message.failed',
      sent: 'message.sent',
    };
    if (eventMap[status]) {
      this.webhooks.dispatch(organizationId, eventMap[status], updated);
    }

    await this.updateCampaignCounters(message.id, status);
  }

  private async updateCampaignCounters(messageId: bigint, status: string) {
    const log = await this.prisma.campaignLog.findFirst({
      where: { messageId },
      include: { campaign: true },
    });
    if (!log) return;

    const campaign = log.campaign;
    const data: any = {};
    if (
      status === 'delivered' &&
      ['running', 'completed'].includes(campaign.status)
    ) {
      data.deliveredCount = { increment: 1 };
    }
    if (status === 'read' && ['running', 'completed'].includes(campaign.status)) {
      data.readCount = { increment: 1 };
    }
    if (status === 'failed') {
      data.failedCount = { increment: 1 };
    }
    await this.prisma.campaignLog.update({
      where: { id: log.id },
      data: { status: status === 'failed' ? 'failed' : 'sent' },
    });
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data,
    });
  }

  async resolveOrganizationIdForWhatsappNumber(phoneNumberId: string): Promise<number> {
    if (phoneNumberId) {
      const number = await this.prisma.whatsappNumber.findFirst({
        where: { phoneNumberId },
        select: { organizationId: true },
      });
      if (number) return Number(number.organizationId);
    }
    // Fallback to first existing organization in DB
    const firstOrg = await this.prisma.organization.findFirst({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return firstOrg ? Number(firstOrg.id) : 1;
  }

  /**
   * Process an incoming customer message (as delivered by Meta / Messenger API).
   * Includes duplicate protection (Requirement 6).
   */
  async processIncomingMessage(params: {
    organizationId: number;
    whatsappNumberId?: string;
    from: string;
    messageType: string;
    text?: string;
    mediaUrl?: string;
    metaMessageId?: string;
  }) {
    const metaMessageId = params.metaMessageId || `wamid.${Date.now()}.incoming`;

    // Requirement 6: DUPLICATE WEBHOOK PROTECTION
    // NOTE: this pre-check is a fast path only, NOT the real guarantee.
    // WhatsApp/BSP webhook redeliveries can arrive within milliseconds of
    // each other, so two requests can both pass this findFirst() before
    // either has committed its insert (classic check-then-act race). The
    // actual guarantee comes from the @@unique([organizationId, metaMessageId])
    // constraint on the Message model, enforced in the try/catch below.
    const existingMessage = await this.prisma.message.findFirst({
      where: {
        organizationId: BigInt(params.organizationId),
        metaMessageId,
      },
      include: { conversation: { include: { contact: true } } },
    });
    if (existingMessage) {
      this.logger.log(`Duplicate webhook detected for metaMessageId ${metaMessageId}. Ignoring.`);
      return existingMessage;
    }

    let number = params.whatsappNumberId
      ? await this.prisma.whatsappNumber.findFirst({
          where: {
            organizationId: BigInt(params.organizationId),
            phoneNumberId: params.whatsappNumberId,
          },
        })
      : null;

    if (!number) {
      number = await this.prisma.whatsappNumber.findFirst({
        where: { organizationId: BigInt(params.organizationId) },
      });
    }

    // Requirement 4: CONTACT MANAGEMENT
    // Normalize to digits-only (no '+') and match against EITHER format,
    // since existing rows may have been saved with or without '+'.
    // This prevents creating duplicate contacts like "+917016526746" and
    // "917016526746" for the same person.
    const digitsOnly = params.from.replace(/\D/g, '');
    const withPlus = `+${digitsOnly}`;

    let contact = await this.prisma.contact.findFirst({
      where: {
        organizationId: BigInt(params.organizationId),
        mobile: { in: [digitsOnly, withPlus] },
      },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          organizationId: BigInt(params.organizationId),
          firstName: digitsOnly,
          mobile: digitsOnly, // canonical format going forward: digits only, no '+'
          source: 'whatsapp',
        },
      });
    }

    // Find active conversation; if not found -> create conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId: BigInt(params.organizationId),
        contactId: contact.id,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId: BigInt(params.organizationId),
          contactId: contact.id,
          whatsappNumberId: number?.id || null,
          status: 'open',
          priority: 'medium',
          channel: 'whatsapp',
        },
      });
    } else if (conversation.status === 'pending' || conversation.status === 'closed') {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'open', closedAt: null },
      });
    }

    // Requirement 8: SENDER TYPE customer
    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          organizationId: BigInt(params.organizationId),
          conversationId: conversation.id,
          whatsappNumberId: number?.id || null,
          senderType: 'customer',
          messageType: params.messageType || 'text',
          messageText: params.text || null,
          mediaUrl: params.mediaUrl || null,
          metaMessageId,
          status: 'received',
          sentAt: new Date(),
        },
        include: { conversation: { include: { contact: true } } },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation on (organizationId, metaMessageId).
      // This means a concurrent/redelivered webhook already created this
      // exact message a few milliseconds ago (classic race condition that
      // the earlier findFirst() pre-check can miss). Safely back off here
      // WITHOUT triggering the bot again, since the other request already
      // did (or is about to).
      if (err.code === 'P2002') {
        this.logger.log(
          `Duplicate webhook (race condition) detected for metaMessageId ${metaMessageId}. Ignoring.`,
        );
        return this.prisma.message.findFirst({
          where: {
            organizationId: BigInt(params.organizationId),
            metaMessageId,
          },
          include: { conversation: { include: { contact: true } } },
        });
      }
      throw err;
    }

    await this.prisma.contact.update({
      where: { id: contact.id },
      data: { lastInteraction: new Date() },
    });

    this.realtime.emitToOrg(params.organizationId, 'message:new', message);
    this.webhooks.dispatch(params.organizationId, 'message.received', message);

    // Requirement 7: CHATBOT - Trigger existing Bot Engine
    await this.botEngine.handleIncoming(
      params.organizationId,
      Number(conversation.id),
      params.text || '',
    );

    return message;
  }
}