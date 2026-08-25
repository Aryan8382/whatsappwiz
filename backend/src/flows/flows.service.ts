import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

@Injectable()
export class FlowsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: number, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) where.name = { contains: search };
    const items = await this.prisma.whatsappFlow.findMany({
      where,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: items.map((f) => ({
        ...f,
        createdByName: f.createdBy
          ? `${f.createdBy.firstName} ${f.createdBy.lastName || ''}`.trim()
          : null,
      })),
      total: items.length,
    };
  }

  async get(organizationId: number, id: number) {
    const flow = await this.prisma.whatsappFlow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }

  async create(organizationId: number, userId: number, dto: CreateFlowDto) {
    const flowRef = `FLOW-${Date.now().toString(36).toUpperCase()}`;
    return this.prisma.whatsappFlow.create({
      data: {
        organizationId: BigInt(organizationId),
        flowRef,
        name: dto.name,
        category: dto.category,
        status: 'draft',
        healthStatus: 'healthy',
        screens: [],
        createdById: BigInt(userId),
      },
    });
  }

  async update(organizationId: number, id: number, dto: UpdateFlowDto) {
    const flow = await this.prisma.whatsappFlow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.prisma.whatsappFlow.update({
      where: { id: flow.id },
      data: {
        name: dto.name ?? undefined,
        category: dto.category ?? undefined,
        screens: dto.screens !== undefined ? dto.screens : undefined,
      },
    });
  }

  async publish(organizationId: number, id: number) {
    const flow = await this.prisma.whatsappFlow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    const screens = Array.isArray(flow.screens) ? (flow.screens as any[]) : [];
    if (screens.length === 0) {
      throw new NotFoundException('Add at least one screen before publishing');
    }
    return this.prisma.whatsappFlow.update({
      where: { id: flow.id },
      data: { status: 'published' },
    });
  }

  async remove(organizationId: number, id: number) {
    const flow = await this.prisma.whatsappFlow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    await this.prisma.whatsappFlow.delete({ where: { id: flow.id } });
    return { success: true };
  }
}
