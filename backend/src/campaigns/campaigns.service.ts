import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';
import { CreateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
  ) {}

  async list(organizationId: number, status?: string, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (status && status !== 'all') where.status = status;
    if (search) where.name = { contains: search };
    return this.prisma.campaign.findMany({
      where,
      include: { template: { select: { id: true, name: true, category: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(organizationId: number, dto: CreateCampaignDto) {
    const template = await this.prisma.template.findFirst({
      where: { id: BigInt(dto.templateId), organizationId: BigInt(organizationId) },
    });
    if (!template) throw new BadRequestException('Template not found');
    const statusLower = (template.status || 'approved').toLowerCase();
    if (!['approved', 'active', 'pending', 'draft'].includes(statusLower)) {
      throw new BadRequestException(`Template "${template.name}" (status: ${template.status}) cannot be used in campaigns`);
    }
    const audience: any = {};
    if (dto.tagIds && dto.tagIds.length > 0) audience.tagIds = dto.tagIds;
    if (dto.segmentIds && dto.segmentIds.length > 0) audience.segmentIds = dto.segmentIds;
    if (dto.contactIds && dto.contactIds.length > 0) audience.contactIds = dto.contactIds;
    if (dto.phoneNumbers && dto.phoneNumbers.length > 0) audience.phoneNumbers = dto.phoneNumbers;

    return this.prisma.campaign.create({
      data: {
        organizationId: BigInt(organizationId),
        templateId: template.id,
        name: dto.name,
        status: 'draft',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        audience: Object.keys(audience).length > 0 ? audience : null,
        ratePerMinute: dto.ratePerMinute || 60,
      },
    });
  }

  async get(organizationId: number, id: number) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      include: {
        template: true,
        logs: {
          include: { contact: { select: { id: true, firstName: true, lastName: true, mobile: true } } },
          orderBy: { createdAt: 'desc' },
          take: 200,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  /** Resolve contacts based on audience (segments, tags, contactIds, phoneNumbers, or all contacts) */
  async getAudienceContacts(organizationId: number, audience: any): Promise<{ id: bigint }[]> {
    const orgId = BigInt(organizationId);
    const tagIds: number[] = audience?.tagIds || [];
    const segmentIds: number[] = audience?.segmentIds || [];
    const contactIds: number[] = audience?.contactIds || [];
    const phoneNumbers: string[] = audience?.phoneNumbers || [];

    // Auto-create/ensure contacts for explicitly provided phone numbers
    if (phoneNumbers.length > 0) {
      for (const phone of phoneNumbers) {
        let clean = phone.replace(/[^\d]/g, '');
        if (clean.length === 10) clean = `91${clean}`;
        let existing = await this.prisma.contact.findFirst({
          where: { organizationId: orgId, mobile: clean },
        });
        if (!existing) {
          existing = await this.prisma.contact.create({
            data: {
              organizationId: orgId,
              firstName: clean,
              mobile: clean,
              source: 'broadcast',
            },
          });
        }
        contactIds.push(Number(existing.id));
      }
    }

    const orConditions: any[] = [];

    // 1. Direct Contact IDs
    if (contactIds.length > 0) {
      const uniqueContactIds = Array.from(new Set(contactIds));
      orConditions.push({
        id: { in: uniqueContactIds.map((id) => BigInt(id)) },
      });
    }

    // 2. Resolve Segment filter criteria
    if (segmentIds.length > 0) {
      const segments = await (this.prisma as any).segment.findMany({
        where: {
          id: { in: segmentIds.map((id) => BigInt(id)) },
          organizationId: orgId,
        },
      });

      for (const seg of segments) {
        let filters: any[] = [];
        if (Array.isArray(seg.filters)) filters = seg.filters;
        else if (typeof seg.filters === 'string') {
          try { filters = JSON.parse(seg.filters); } catch { filters = []; }
        }

        const validFilters = filters.filter((f) => f && f.field && (f.value || (f.operator || '').toLowerCase().includes('empty')));
        if (validFilters.length > 0) {
          const AND: any[] = [];
          const fieldMap: Record<string, string> = {
            name: 'firstName', Name: 'firstName',
            firstName: 'firstName', 'First Name': 'firstName',
            lastName: 'lastName', 'Last Name': 'lastName',
            phone: 'mobile', Phone: 'mobile', mobile: 'mobile',
            'Phone Number': 'mobile', phoneNumber: 'mobile',
            email: 'email', Email: 'email',
            city: 'city', City: 'city',
            country: 'country', Country: 'country',
          };

          for (const f of validFilters) {
            const dbField = fieldMap[f.field] || f.field;
            const val = (f.value || '').trim();
            const op = (f.operator || 'is').toLowerCase().replace(/[\s-]+/g, '_');

            if (op === 'is' || op === 'equals' || op === 'contains') {
              if (dbField === 'firstName') {
                AND.push({ OR: [{ firstName: { contains: val } }, { lastName: { contains: val } }] });
              } else {
                AND.push({ [dbField]: { contains: val } });
              }
            } else if (op === 'is_not' || op === 'not_equals' || op === 'does_not_contain' || op === 'does_not_contains') {
              if (dbField === 'firstName') {
                AND.push({ NOT: { OR: [{ firstName: { contains: val } }, { lastName: { contains: val } }] } });
              } else {
                AND.push({ NOT: { [dbField]: { contains: val } } });
              }
            } else if (op === 'is_empty') {
              AND.push({ OR: [{ [dbField]: null }, { [dbField]: '' }] });
            } else if (op === 'is_not_empty') {
              AND.push({ AND: [{ [dbField]: { not: null } }, { [dbField]: { not: '' } }] });
            } else if (op === 'starts_with') {
              AND.push({ [dbField]: { startsWith: val } });
            } else if (op === 'ends_with') {
              AND.push({ [dbField]: { endsWith: val } });
            }
          }
          if (AND.length > 0) {
            orConditions.push({ AND });
          }
        }
      }
    }

    // 3. Resolve Tags
    if (tagIds.length > 0) {
      orConditions.push({
        contactTags: { some: { tagId: { in: tagIds.map((t) => BigInt(t)) } } },
      });
    }

    const where: any = { organizationId: orgId };
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    return this.prisma.contact.findMany({
      where,
      select: { id: true },
    });
  }

  async start(organizationId: number, id: number) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      include: { template: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new BadRequestException(`Cannot start a campaign in "${campaign.status}" state`);
    }

    const contacts = await this.getAudienceContacts(organizationId, campaign.audience);
    if (contacts.length === 0) {
      throw new BadRequestException('No contacts match the campaign audience');
    }

    // Delete existing pending logs if restarting
    await this.prisma.campaignLog.deleteMany({
      where: { campaignId: campaign.id, status: 'pending' },
    });

    const logsData = contacts.map((c) => ({
      campaignId: campaign.id,
      contactId: c.id,
      status: 'pending',
    }));
    await this.prisma.campaignLog.createMany({ data: logsData });

    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        totalContacts: contacts.length,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
      },
    });
    this.realtime.emitToOrg(organizationId, 'campaign:updated', updated);
    this.webhooks.dispatch(organizationId, 'campaign.started', updated);
    return updated;
  }

  async pause(organizationId: number, id: number) {
    const campaign = await this.findOwned(organizationId, id);
    if (campaign.status !== 'running') {
      throw new BadRequestException('Only running campaigns can be paused');
    }
    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'paused' },
    });
    this.realtime.emitToOrg(organizationId, 'campaign:updated', updated);
    return updated;
  }

  async resume(organizationId: number, id: number) {
    const campaign = await this.findOwned(organizationId, id);
    if (campaign.status !== 'paused') {
      throw new BadRequestException('Only paused campaigns can be resumed');
    }
    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'running' },
    });
    this.realtime.emitToOrg(organizationId, 'campaign:updated', updated);
    return updated;
  }

  async analytics(organizationId: number, id: number) {
    const campaign = await this.get(organizationId, id);
    const pendingCount = campaign.logs.filter((l) => l.status === 'pending').length;
    return {
      id: Number(campaign.id),
      name: campaign.name,
      status: campaign.status,
      totalContacts: campaign.totalContacts,
      sentCount: campaign.sentCount,
      deliveredCount: campaign.deliveredCount,
      readCount: campaign.readCount,
      failedCount: campaign.failedCount,
      pendingCount,
      deliveryRate:
        campaign.totalContacts > 0
          ? Math.round((campaign.deliveredCount / campaign.totalContacts) * 100)
          : 0,
    };
  }

  async remove(organizationId: number, id: number) {
    const campaign = await this.findOwned(organizationId, id);
    await this.prisma.campaignLog.deleteMany({ where: { campaignId: campaign.id } });
    await this.prisma.campaign.delete({ where: { id: campaign.id } });
    return { success: true };
  }

  private async findOwned(organizationId: number, id: number) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
