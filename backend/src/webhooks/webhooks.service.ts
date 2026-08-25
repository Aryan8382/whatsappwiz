import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private dispatch: WebhookDispatchService,
  ) {}

  async list(organizationId: number) {
    return this.prisma.webhook.findMany({
      where: { organizationId: BigInt(organizationId) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true } } },
    });
  }

  async create(organizationId: number, dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        organizationId: BigInt(organizationId),
        endpoint: dto.url,
        secret: dto.secret || randomUUID().replace(/-/g, '').slice(0, 32),
        events: dto.events as any,
      },
    });
  }

  async update(organizationId: number, id: number, dto: UpdateWebhookDto) {
    const webhook = await this.findOwned(organizationId, id);
    return this.prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        endpoint: dto.url !== undefined ? dto.url : undefined,
        events: dto.events !== undefined ? (dto.events as any) : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
  }

  async remove(organizationId: number, id: number) {
    const webhook = await this.findOwned(organizationId, id);
    await this.prisma.webhook.delete({ where: { id: webhook.id } });
    return { success: true };
  }

  async test(organizationId: number, id: number) {
    const webhook = await this.findOwned(organizationId, id);
    await this.dispatch.dispatch(organizationId, 'webhook.test', {
      message: 'Test payload from Whatsapp Wiz',
      webhookId: Number(webhook.id),
    });
    return { success: true, message: 'Test event dispatched' };
  }

  async logs(organizationId: number, webhookId: number, page = 1, limit = 20) {
    const webhook = await this.findOwned(organizationId, webhookId);
    const where = { webhookId: webhook.id };
    const [items, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private async findOwned(organizationId: number, id: number) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }
}
