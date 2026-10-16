import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { MockWhatsappService } from '../messages/mock-whatsapp.service';
import { MessengerService } from '../messages/messenger.service';
import { WebhookReceiverService } from '../messages/webhook-receiver.service';
import { WalletService } from '../wallet/wallet.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private processing = new Set<number>();

  constructor(
    private prisma: PrismaService,
    private mockWhatsapp: MockWhatsappService,
    private messenger: MessengerService,
    private webhookReceiver: WebhookReceiverService,
    private wallet: WalletService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
    private config: ConfigService,
    @Inject(forwardRef(() => CampaignsService))
    private campaignsService: CampaignsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 2000);
    this.logger.log('Campaign scheduler started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      await this.startScheduled();
      await this.processRunning();
    } catch (e) {
      this.logger.error(`Scheduler tick error: ${(e as Error).message}`);
    }
  }

  private async startScheduled() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    });
    for (const campaign of campaigns) {
      const contacts = await this.campaignsService.getAudienceContacts(
        Number(campaign.organizationId),
        campaign.audience,
      );
      if (contacts.length === 0) {
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'completed', completedAt: new Date() },
        });
        continue;
      }
      await this.prisma.campaignLog.createMany({
        data: contacts.map((c) => ({
          campaignId: campaign.id,
          contactId: c.id,
          status: 'pending',
        })),
      });
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'running',
          startedAt: new Date(),
          totalContacts: contacts.length,
        },
      });
      const running = await this.prisma.campaign.findUnique({
        where: { id: campaign.id },
      });
      this.realtime.emitToOrg(Number(campaign.organizationId), 'campaign:updated', running);
      this.webhooks.dispatch(Number(campaign.organizationId), 'campaign.started', running);
    }
  }

  private async processRunning() {
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: 'running' },
      include: { template: true },
    });
    for (const campaign of campaigns) {
      const id = Number(campaign.id);
      if (this.processing.has(id)) continue;
      this.processing.add(id);
      try {
        await this.processCampaign(campaign);
      } catch (e) {
        this.logger.error(`Campaign ${id} processing error: ${(e as Error).message}`);
      } finally {
        this.processing.delete(id);
      }
    }
  }

  private async processCampaign(campaign: any) {
    const batchSize = Math.max(1, Math.round((campaign.ratePerMinute || 60) / 30));
    const pendingLogs = await this.prisma.campaignLog.findMany({
      where: { campaignId: campaign.id, status: 'pending' },
      include: { contact: true },
      take: batchSize,
    });

    if (pendingLogs.length === 0) {
      const updated = await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      this.realtime.emitToOrg(
        Number(campaign.organizationId),
        'campaign:updated',
        updated,
      );
      this.webhooks.dispatch(
        Number(campaign.organizationId),
        'campaign.completed',
        updated,
      );
      return;
    }

    const cost = Number(this.config.get('COST_TEMPLATE') || '0.30');
    let insufficient = false;

    for (const log of pendingLogs) {
      if (insufficient) break;
      try {
        await this.wallet.debit(
          Number(campaign.organizationId),
          cost,
          'debit',
          `campaign-${campaign.id}-${Date.now()}`,
          `Campaign "${campaign.name}" to ${log.contact.mobile}`,
        );
      } catch {
        insufficient = true;
        await this.prisma.campaignLog.update({
          where: { id: log.id },
          data: { status: 'failed', error: 'Insufficient wallet balance' },
        });
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        });
        continue;
      }

      const text = this.personalize(campaign.template?.body || '', log.contact);

      // 1. Build template body parameters if template has {{1}}, {{2}} variables
      const components: any[] = [];
      const bodyVars = (campaign.template?.body || '').match(/\{\{(\d+)\}\}/g);
      if (bodyVars && bodyVars.length > 0) {
        const uniqueVars = Array.from(new Set(bodyVars));
        const parameters = uniqueVars.map((_, idx) => {
          let val = log.contact.firstName || '';
          if (!val || val.trim() === '') val = log.contact.lastName || '';
          if (!val || val.trim() === '') val = 'Customer';
          return {
            type: 'text',
            text: val.trim(),
          };
        });
        components.push({
          type: 'body',
          parameters,
        });
      }

      // 2. Format phone number
      let targetMobile = (log.contact.mobile || '').replace(/[^\d]/g, '');
      if (targetMobile.startsWith('0') && targetMobile.length === 11) {
        targetMobile = targetMobile.substring(1);
      }
      if (targetMobile.length === 10) {
        targetMobile = `91${targetMobile}`;
      }

      const result = await this.messenger.sendTemplate(
        targetMobile,
        campaign.template?.name || '',
        campaign.template?.language || 'en',
        components,
      );

      if (result.status === 'failed') {
        const errorReason = result.error || 'Meta API send failed';
        await this.prisma.campaignLog.update({
          where: { id: log.id },
          data: { status: 'failed', error: errorReason },
        });
        await this.prisma.campaign.update({
          where: { id: campaign.id },
          data: { failedCount: { increment: 1 } },
        });
        this.webhooks.dispatch(
          Number(campaign.organizationId),
          'message.failed',
          { campaignId: Number(campaign.id), contact: targetMobile, error: errorReason },
        );
        continue;
      }

      let textToSave = text;
      let parsedButtons: any[] = [];
      if (campaign.template?.buttons) {
        try {
          parsedButtons = typeof campaign.template.buttons === 'string'
            ? JSON.parse(campaign.template.buttons)
            : campaign.template.buttons;
        } catch {}
      }

      if (campaign.template?.header || campaign.template?.footer || (parsedButtons && parsedButtons.length > 0)) {
        textToSave = JSON.stringify({
          header: campaign.template?.header || null,
          body: text,
          footer: campaign.template?.footer || null,
          buttons: parsedButtons,
          headerType: campaign.template?.header ? campaign.template.header.replace(/[\[\]]/g, '').toLowerCase() : undefined,
        });
      }

      const message = await this.prisma.message.create({
        data: {
          organizationId: campaign.organizationId,
          conversationId: await this.getOrCreateConversation(
            campaign.organizationId,
            log.contact.id,
          ),
          senderType: 'system',
          messageType: 'template',
          messageText: textToSave,
          metaMessageId: result.metaMessageId,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      await this.prisma.campaignLog.update({
        where: { id: log.id },
        data: { status: 'sent', messageId: message.id },
      });
      await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { sentCount: { increment: 1 } },
      });
      if (log.contact?.id) {
        await this.prisma.contact.update({
          where: { id: log.contact.id },
          data: { lastInteraction: new Date() },
        }).catch(() => {});
      }
      await this.prisma.conversation.update({
        where: { id: message.conversationId },
        data: { status: 'open', updatedAt: new Date() },
      }).catch(() => {});

      this.realtime.emitToOrg(Number(campaign.organizationId), 'message:new', message);
      this.webhooks.dispatch(Number(campaign.organizationId), 'message.sent', message);

      this.scheduleStatus(Number(campaign.organizationId), result.metaMessageId);
    }

    if (insufficient) {
      const updated = await this.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'paused' },
      });
      this.realtime.emitToOrg(
        Number(campaign.organizationId),
        'campaign:updated',
        updated,
      );
    }
  }

  private scheduleStatus(organizationId: number, metaMessageId: string) {
    setTimeout(() => {
      this.webhookReceiver
        .processStatus(organizationId, metaMessageId, 'delivered')
        .catch(() => undefined);
    }, 1500);
    if (Math.random() < 0.75) {
      setTimeout(() => {
        this.webhookReceiver
          .processStatus(organizationId, metaMessageId, 'read')
          .catch(() => undefined);
      }, 4000);
    }
  }

  private async getOrCreateConversation(organizationId: bigint, contactId: bigint) {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId,
        status: { in: ['open', 'pending'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          organizationId,
          contactId,
          status: 'open',
          channel: 'whatsapp',
        },
      });
    }
    return conversation.id;
  }

  private personalize(body: string, contact: any) {
    let text = body || '';
    const values: Record<string, string> = {
      '{{1}}': contact.firstName || '',
      '{{first_name}}': contact.firstName || '',
      '{{last_name}}': contact.lastName || '',
      '{{name}}': `${contact.firstName} ${contact.lastName || ''}`.trim(),
      '{{mobile}}': contact.mobile,
    };
    for (const [key, value] of Object.entries(values)) {
      text = text.split(key).join(value);
    }
    return text;
  }
}
