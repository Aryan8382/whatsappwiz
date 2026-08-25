import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDndDto } from './dto/dnd.dto';

@Injectable()
export class DndService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: number, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) where.number = { contains: search };
    const items = await this.prisma.dndEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { items, total: items.length };
  }

  async create(organizationId: number, dto: CreateDndDto) {
    const number = dto.number.replace(/[^+\d]/g, '');
    if (!number) throw new BadRequestException('A valid number is required');
    const existing = await this.prisma.dndEntry.findFirst({
      where: { organizationId: BigInt(organizationId), number },
    });
    if (existing) throw new BadRequestException('This number is already in the DND list');
    return this.prisma.dndEntry.create({
      data: {
        organizationId: BigInt(organizationId),
        number,
        message: dto.message || 'Stop',
      },
    });
  }

  async remove(organizationId: number, id: number) {
    const entry = await this.prisma.dndEntry.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!entry) throw new NotFoundException('DND entry not found');
    await this.prisma.dndEntry.delete({ where: { id: entry.id } });
    return { success: true };
  }
}
