import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhookDispatchService } from '../webhooks/webhook-dispatch.service';

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private webhooks: WebhookDispatchService,
  ) {}

  async list(
    organizationId: number,
    opts: {
      status?: string;
      assignedAgentId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (opts.status && opts.status !== 'all') where.status = opts.status;
    if (opts.assignedAgentId) where.assignedAgentId = BigInt(opts.assignedAgentId);
    if (opts.search) {
      where.contact = {
        OR: [
          { firstName: { contains: opts.search } },
          { lastName: { contains: opts.search } },
          { mobile: { contains: opts.search } },
        ],
      };
    }
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          assignedAgent: { select: { id: true, firstName: true, lastName: true } },
          whatsappNumber: { select: { id: true, phoneNumber: true, displayName: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          labels: { include: { label: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return {
      items: items.map(({ labels, ...c }) => ({
        ...c,
        labels: labels.map((l) => l.label),
      })),
      total,
      page,
      limit,
    };
  }

  async get(organizationId: number, id: number) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      include: {
        contact: true,
        assignedAgent: { select: { id: true, firstName: true, lastName: true } },
        whatsappNumber: true,
        labels: { include: { label: true } },
        notes: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const { labels, ...rest } = conversation;
    return { ...rest, labels: labels.map((l) => l.label) };
  }

  async assign(organizationId: number, id: number, agentId: number) {
    const conversation = await this.findOwned(organizationId, id);
    const agent = await this.prisma.user.findFirst({
      where: { id: BigInt(agentId), organizationId: BigInt(organizationId) },
    });
    if (!agent) throw new BadRequestException('Agent not found in this organization');
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedAgentId: BigInt(agentId), status: 'open' },
    });
    this.realtime.emitToOrg(organizationId, 'conversation:updated', updated);
    this.webhooks.dispatch(organizationId, 'conversation.assigned', updated);
    return updated;
  }

  async transfer(organizationId: number, id: number, agentId: number) {
    return this.assign(organizationId, id, agentId);
  }

  async setStatus(organizationId: number, id: number, status: string) {
    if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
      throw new BadRequestException('Invalid conversation status');
    }
    const conversation = await this.findOwned(organizationId, id);
    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status,
        closedAt: status === 'closed' ? new Date() : status === 'open' ? null : undefined,
      },
    });
    this.realtime.emitToOrg(organizationId, 'conversation:updated', updated);
    if (status === 'closed') {
      this.webhooks.dispatch(organizationId, 'conversation.closed', updated);
    }
    return updated;
  }

  async addNote(organizationId: number, id: number, userId: number, note: string) {
    const conversation = await this.findOwned(organizationId, id);
    const created = await this.prisma.conversationNote.create({
      data: {
        conversationId: conversation.id,
        userId: BigInt(userId),
        note,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    this.realtime.emitToOrg(organizationId, 'conversation:note', created);
    return created;
  }

  async notes(organizationId: number, id: number) {
    await this.findOwned(organizationId, id);
    return this.prisma.conversationNote.findMany({
      where: { conversationId: BigInt(id) },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async labels(organizationId: number) {
    return this.prisma.conversationLabel.findMany({
      where: { organizationId: BigInt(organizationId) },
      orderBy: { label: 'asc' },
    });
  }

  async createLabel(organizationId: number, label: string, color?: string) {
    const existing = await this.prisma.conversationLabel.findFirst({
      where: { organizationId: BigInt(organizationId), label },
    });
    if (existing) throw new BadRequestException('Label already exists');
    return this.prisma.conversationLabel.create({
      data: {
        organizationId: BigInt(organizationId),
        label,
        color: color || '#25D366',
      },
    });
  }

  async assignLabel(organizationId: number, id: number, labelId: number) {
    const conversation = await this.findOwned(organizationId, id);
    const label = await this.prisma.conversationLabel.findFirst({
      where: { id: BigInt(labelId), organizationId: BigInt(organizationId) },
    });
    if (!label) throw new BadRequestException('Label not found');
    await this.prisma.conversationLabelMap.upsert({
      where: {
        conversationId_labelId: {
          conversationId: conversation.id,
          labelId: label.id,
        },
      },
      create: { conversationId: conversation.id, labelId: label.id },
      update: {},
    });
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { labels: { include: { label: true } } },
    });
    this.realtime.emitToOrg(organizationId, 'conversation:updated', updated);
    return updated;
  }

  async unassignLabel(organizationId: number, id: number, labelId: number) {
    const conversation = await this.findOwned(organizationId, id);
    await this.prisma.conversationLabelMap.deleteMany({
      where: { conversationId: conversation.id, labelId: BigInt(labelId) },
    });
    const updated = await this.prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: { labels: { include: { label: true } } },
    });
    this.realtime.emitToOrg(organizationId, 'conversation:updated', updated);
    return updated;
  }

  private async findOwned(organizationId: number, id: number) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}
