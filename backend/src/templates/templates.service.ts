import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

import { MessengerService } from '../messages/messenger.service';

@Injectable()
export class TemplatesService {
  private lastSyncTime = 0;

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
    private messenger: MessengerService,
  ) {}

  async syncWithRemote(organizationId: number) {
    try {
      const remoteRes = await this.messenger.getTemplates(100);
      let remote: any[] = [];
      if (Array.isArray(remoteRes)) {
        remote = remoteRes;
      } else if (Array.isArray(remoteRes?.data)) {
        remote = remoteRes.data;
      } else if (Array.isArray(remoteRes?.data?.data)) {
        remote = remoteRes.data.data;
      } else if (Array.isArray(remoteRes?.templates)) {
        remote = remoteRes.templates;
      }

      if (remote.length === 0) {
        return { success: true, count: 0, total: 0, raw: remoteRes };
      }

      let syncedCount = 0;
      for (const t of remote) {
        let headerText: string | null = null;
        let bodyText = '';
        let footerText: string | null = null;
        let buttonsData: string | null = null;

        if (Array.isArray(t.components)) {
          for (const comp of t.components) {
            if (comp.type === 'HEADER') {
              headerText = comp.text || (comp.format ? `[${comp.format}]` : null);
            }
            if (comp.type === 'BODY' && comp.text) bodyText = comp.text;
            if (comp.type === 'FOOTER' && comp.text) footerText = comp.text;
            if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
              buttonsData = JSON.stringify(comp.buttons);
            }
          }
        }

        if (!bodyText) bodyText = t.body || t.name;

        const existing = await this.prisma.template.findFirst({
          where: {
            organizationId: BigInt(organizationId),
            name: t.name,
          },
        });

        const status = (t.status || 'APPROVED').toLowerCase();
        const category = (t.category || 'MARKETING').toUpperCase();
        const language = t.language || 'en';

        if (existing) {
          await this.prisma.template.update({
            where: { id: existing.id },
            data: {
              category,
              language,
              status,
              header: headerText || existing.header,
              body: bodyText,
              footer: footerText || existing.footer,
              buttons: buttonsData || existing.buttons,
              metaTemplateId: t.id ? String(t.id) : existing.metaTemplateId,
            },
          });
        } else {
          await this.prisma.template.create({
            data: {
              organizationId: BigInt(organizationId),
              name: t.name,
              category,
              language,
              status,
              header: headerText,
              body: bodyText,
              footer: footerText,
              buttons: buttonsData,
              metaTemplateId: t.id ? String(t.id) : null,
            },
          });
        }
        syncedCount++;
      }
      if (syncedCount > 0) {
        this.realtime.emitToOrg(organizationId, 'template:synced', { count: syncedCount });
      }
      return { success: true, count: syncedCount, total: remote.length };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to sync templates' };
    }
  }

  async list(
    organizationId: number,
    category?: string,
    status?: string,
    search?: string,
  ) {
    // Live sync with remote Meta every 5 seconds
    const now = Date.now();
    if (now - this.lastSyncTime > 5000) {
      this.lastSyncTime = now;
      await this.syncWithRemote(organizationId);
    }

    const where: any = { organizationId: BigInt(organizationId) };
    if (category) where.category = category.toUpperCase();
    if (status) where.status = status.toLowerCase();
    if (search) where.name = { contains: search };
    return this.prisma.template.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }


  async create(organizationId: number, dto: CreateTemplateDto) {
    if (!dto.body?.trim()) {
      throw new BadRequestException('Template body is required');
    }
    const cleanName = dto.name.toLowerCase().replace(/[^\w]/g, '_');
    const buttonsStr = dto.buttons
      ? typeof dto.buttons === 'string'
        ? dto.buttons
        : JSON.stringify(dto.buttons)
      : null;

    const created = await this.prisma.template.create({
      data: {
        organizationId: BigInt(organizationId),
        name: cleanName,
        category: (dto.category || 'UTILITY').toUpperCase(),
        language: dto.language || 'en',
        header: dto.header || null,
        body: dto.body,
        footer: dto.footer || null,
        buttons: buttonsStr,
        status: 'draft',
      },
    });

    // Auto submit to Meta API for approval
    try {
      await this.submit(organizationId, Number(created.id), dto.headerMediaUrl);
    } catch (err: any) {
      // Keep template in DB so user can inspect error/rejection details
    }

    const result = await this.findOwned(organizationId, Number(created.id));
    this.realtime.emitToOrg(organizationId, 'template:new', result);
    return result;
  }

  async update(organizationId: number, id: number, dto: UpdateTemplateDto) {
    const template = await this.findOwned(organizationId, id);
    if (!['draft', 'rejected'].includes(template.status)) {
      throw new BadRequestException('Only draft or rejected templates can be edited');
    }
    const buttonsStr =
      dto.buttons !== undefined
        ? typeof dto.buttons === 'string'
          ? dto.buttons
          : JSON.stringify(dto.buttons)
        : undefined;

    return this.prisma.template.update({
      where: { id: template.id },
      data: {
        name: dto.name !== undefined ? dto.name.toLowerCase().replace(/[^\w]/g, '_') : undefined,
        category: dto.category ? dto.category.toUpperCase() : undefined,
        language: dto.language !== undefined ? dto.language : undefined,
        header: dto.header !== undefined ? dto.header : undefined,
        body: dto.body !== undefined ? dto.body : undefined,
        footer: dto.footer !== undefined ? dto.footer : undefined,
        buttons: buttonsStr,
        status: 'draft',
      },
    });
  }

  async submit(organizationId: number, id: number, headerMediaUrl?: string) {
    const template = await this.findOwned(organizationId, id);
    if (template.status === 'approved') {
      throw new BadRequestException('Template is already approved');
    }

    let parsedButtons: any[] = [];
    if (template.buttons) {
      try {
        parsedButtons = typeof template.buttons === 'string' ? JSON.parse(template.buttons) : template.buttons;
      } catch {}
    }

    // Try to submit via The Messenger API's create_template endpoint
    // Note: The Messenger API may not have a create_template endpoint -
    // if it fails, we mark as pending and user must approve in Meta Business Manager directly.
    let metaTemplateId = `wiz-${randomUUID().slice(0, 18)}`;
    let submitError: string | null = null;

    try {
      const res = await this.messenger.createTemplate({
        name: template.name,
        category: template.category,
        language: template.language || 'en',
        header: template.header,
        headerMediaUrl,
        body: template.body,
        footer: template.footer,
        buttons: parsedButtons,
      });

      if (res.success) {
        metaTemplateId = res.data?.id ? String(res.data.id) : metaTemplateId;
      } else {
        submitError = res.error || 'The Messenger API does not support template creation. Please submit the template in Meta Business Manager directly.';
      }
    } catch (err: any) {
      submitError = `Template API call failed: ${err.message}`;
    }

    const updated = await this.prisma.template.update({
      where: { id: template.id },
      data: {
        status: 'pending',
        metaTemplateId,
        rejectionReason: submitError || null,
      },
    });

    this.realtime.emitToOrg(organizationId, 'template:status', {
      templateId: Number(template.id),
      status: 'pending',
    });
    this.webhooks.dispatch(organizationId, 'template.submitted', updated);

    // Auto-sync with remote Meta to fetch latest approval status after 5s
    setTimeout(() => {
      void this.syncWithRemote(organizationId);
    }, 5000);

    if (submitError) {
      return {
        success: true,
        status: 'pending',
        warning: submitError,
        data: updated,
      };
    }

    return { success: true, status: 'pending', data: updated };
  }

  async remove(organizationId: number, id: number) {
    const template = await this.findOwned(organizationId, id);
    await this.prisma.template.delete({ where: { id: template.id } });
    return { success: true };
  }

  async findApprovedForCampaign(organizationId: number, id: number) {
    const template = await this.findOwned(organizationId, id);
    const statusLower = (template.status || 'approved').toLowerCase();
    if (!['approved', 'active', 'pending', 'draft'].includes(statusLower)) {
      throw new BadRequestException(`Template "${template.name}" cannot be used in campaigns`);
    }
    return template;
  }

  private async findOwned(organizationId: number, id: number) {
    const template = await this.prisma.template.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }
}
