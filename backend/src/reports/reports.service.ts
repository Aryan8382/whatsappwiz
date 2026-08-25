import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard(organizationId: number) {
    const orgId = BigInt(organizationId);
    const [conversations, openConversations, messages, failedMessages, campaigns, wallet, agents, numbers] =
      await Promise.all([
        this.prisma.conversation.count({ where: { organizationId: orgId } }),
        this.prisma.conversation.count({
          where: { organizationId: orgId, status: { in: ['open', 'pending'] } },
        }),
        this.prisma.message.findMany({
          where: { organizationId: orgId },
          select: {
            status: true,
            senderType: true,
            createdAt: true,
            id: true,
          },
        }),
        this.prisma.message.count({
          where: { organizationId: orgId, status: 'failed' },
        }),
        this.prisma.campaign.findMany({
          where: { organizationId: orgId },
          select: {
            id: true,
            name: true,
            status: true,
            totalContacts: true,
            sentCount: true,
            deliveredCount: true,
            readCount: true,
            failedCount: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.wallet.findUnique({ where: { organizationId: orgId } }),
        this.prisma.user.count({ where: { organizationId: orgId, status: 'active' } }),
        this.prisma.whatsappNumber.count({ where: { organizationId: orgId } }),
      ]);

    const sent = messages.filter((m) => m.senderType !== 'customer');
    const received = messages.filter((m) => m.senderType === 'customer');
    const delivered = messages.filter(
      (m) => m.status === 'delivered' || m.status === 'read',
    );
    const read = messages.filter((m) => m.status === 'read');
    const nonFailed = messages.length - failedMessages;

    const days: { date: string; sent: number; received: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const daySent = sent.filter(
        (m) => m.createdAt >= d && m.createdAt < next,
      ).length;
      const dayReceived = received.filter(
        (m) => m.createdAt >= d && m.createdAt < next,
      ).length;
      days.push({
        date: d.toISOString().slice(0, 10),
        sent: daySent,
        received: dayReceived,
      });
    }

    const recentConversations = await this.prisma.conversation.findMany({
      where: { organizationId: orgId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });

    return {
      kpis: {
        totalConversations: conversations,
        openConversations,
        messagesSent: sent.length,
        messagesReceived: received.length,
        deliveredRate:
          sent.length > 0 ? Math.round((delivered.length / sent.length) * 100) : 0,
        readRate: sent.length > 0 ? Math.round((read.length / sent.length) * 100) : 0,
        failedCount: failedMessages,
        activeAgents: agents,
        connectedNumbers: numbers,
        walletBalance: wallet?.balance || 0,
        walletCurrency: wallet?.currency || 'INR',
        activeCampaigns: campaigns.filter((c) => c.status === 'running').length,
      },
      messageTrend: days,
      campaigns: campaigns,
      recentConversations,
    };
  }

  async messages(organizationId: number, from?: string, to?: string) {
    const orgId = BigInt(organizationId);
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const where: any = { organizationId: orgId };
    if (from || to) where.createdAt = dateFilter;

    const messages = await this.prisma.message.findMany({
      where,
      select: { status: true, senderType: true, messageType: true, createdAt: true },
    });
    const byStatus: Record<string, number> = {};
    for (const m of messages) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    }
    const byType: Record<string, number> = {};
    for (const m of messages) {
      byType[m.messageType] = (byType[m.messageType] || 0) + 1;
    }
    return {
      total: messages.length,
      sent: messages.filter((m) => m.senderType !== 'customer').length,
      received: messages.filter((m) => m.senderType === 'customer').length,
      byStatus,
      byType,
    };
  }

  async campaigns(organizationId: number) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((c) => ({
      id: Number(c.id),
      name: c.name,
      template: c.template?.name,
      status: c.status,
      totalContacts: c.totalContacts,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      readCount: c.readCount,
      failedCount: c.failedCount,
      deliveryRate:
        c.totalContacts > 0
          ? Math.round((c.deliveredCount / c.totalContacts) * 100)
          : 0,
      readRate:
        c.totalContacts > 0 ? Math.round((c.readCount / c.totalContacts) * 100) : 0,
    }));
  }

  async agents(organizationId: number) {
    const conversations = await this.prisma.conversation.findMany({
      where: { organizationId: BigInt(organizationId), assignedAgentId: { not: null } },
      select: { assignedAgentId: true, status: true },
    });
    const messages = await this.prisma.message.findMany({
      where: {
        organizationId: BigInt(organizationId),
        senderType: { in: ['agent', 'bot', 'system'] },
      },
      select: { senderId: true, status: true, conversationId: true },
    });
    const agents = await this.prisma.user.findMany({
      where: { organizationId: BigInt(organizationId), status: 'active' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    return agents.map((agent) => {
      const agentConv = conversations.filter(
        (c) => c.assignedAgentId === agent.id,
      );
      const agentMsgs = messages.filter((m) => m.senderId === agent.id);
      return {
        id: Number(agent.id),
        name: `${agent.firstName} ${agent.lastName || ''}`.trim(),
        email: agent.email,
        conversationsAssigned: agentConv.length,
        resolved: agentConv.filter((c) => c.status === 'resolved' || c.status === 'closed').length,
        messagesSent: agentMsgs.length,
        delivered: agentMsgs.filter((m) => m.status === 'delivered' || m.status === 'read').length,
      };
    });
  }

  async exportCsv(organizationId: number, type: string) {
    if (type === 'messages') {
      const data = await this.messages(organizationId);
      const rows = [
        ['metric', 'value'],
        ['total', data.total],
        ['sent', data.sent],
        ['received', data.received],
        ...Object.entries(data.byStatus).map(([k, v]) => [`status:${k}`, v]),
        ...Object.entries(data.byType).map(([k, v]) => [`type:${k}`, v]),
      ];
      return rows.map((r) => r.join(',')).join('\n');
    }
    if (type === 'campaigns') {
      const data = await this.campaigns(organizationId);
      const header = [
        'id,name,template,status,total,sent,delivered,read,failed,deliveryRate,readRate',
      ];
      const rows = data.map((c) =>
        [
          c.id,
          c.name,
          c.template,
          c.status,
          c.totalContacts,
          c.sentCount,
          c.deliveredCount,
          c.readCount,
          c.failedCount,
          c.deliveryRate,
          c.readRate,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      return [...header, ...rows].join('\n');
    }
    if (type === 'agents') {
      const data = await this.agents(organizationId);
      const header = ['name,email,conversations,resolved,messagesSent,delivered'];
      const rows = data.map((a) =>
        [a.name, a.email, a.conversationsAssigned, a.resolved, a.messagesSent, a.delivered]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      return [...header, ...rows].join('\n');
    }
    return 'No data';
  }
}
