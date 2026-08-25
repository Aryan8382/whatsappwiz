import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';

@Injectable()
export class AutomationService {
  constructor(private prisma: PrismaService) {}

  async stats(organizationId: number) {
    const where = { organizationId: BigInt(organizationId) };
    const [total, active, draft, paused] = await Promise.all([
      this.prisma.automationWorkflow.count({ where }),
      this.prisma.automationWorkflow.count({ where: { ...where, status: 'active' } }),
      this.prisma.automationWorkflow.count({ where: { ...where, status: 'draft' } }),
      this.prisma.automationWorkflow.count({ where: { ...where, status: 'paused' } }),
    ]);
    return { total, active, draft, paused };
  }

  async list(organizationId: number, search?: string, status?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) where.name = { contains: search };
    if (status && status !== 'all') where.status = status;
    const items = await this.prisma.automationWorkflow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      items: items.map((w) => ({
        ...w,
        stepCount: Array.isArray(w.steps) ? (w.steps as any[]).length : 0,
      })),
      total: items.length,
    };
  }

  async get(organizationId: number, id: number) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(organizationId: number, userId: number, dto: CreateAutomationDto) {
    return this.prisma.automationWorkflow.create({
      data: {
        organizationId: BigInt(organizationId),
        name: dto.name || 'Untitled workflow',
        status: dto.status || 'draft',
        steps: [],
        createdById: BigInt(userId),
      },
    });
  }

  async update(organizationId: number, id: number, dto: UpdateAutomationDto) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.prisma.automationWorkflow.update({
      where: { id: workflow.id },
      data: {
        name: dto.name ?? undefined,
        status: dto.status ?? undefined,
        triggerType: dto.triggerType ?? undefined,
        triggerConfig: dto.triggerConfig !== undefined ? dto.triggerConfig : undefined,
        steps: dto.steps !== undefined ? dto.steps : undefined,
      },
    });
  }

  async activate(organizationId: number, id: number) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (!workflow.triggerType) {
      throw new NotFoundException('Select a trigger before activating this workflow');
    }
    return this.prisma.automationWorkflow.update({
      where: { id: workflow.id },
      data: { status: 'active' },
    });
  }

  async pause(organizationId: number, id: number) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.prisma.automationWorkflow.update({
      where: { id: workflow.id },
      data: { status: 'paused' },
    });
  }

  async remove(organizationId: number, id: number) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    await this.prisma.automationWorkflow.delete({ where: { id: workflow.id } });
    return { success: true };
  }
}
