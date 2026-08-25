import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: number, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) {
      where.name = { contains: search };
    }
    const items = await this.prisma.customField.findMany({
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

  async create(organizationId: number, userId: number, dto: CreateCustomFieldDto) {
    const existing = await this.prisma.customField.findFirst({
      where: { organizationId: BigInt(organizationId), name: dto.name },
    });
    if (existing) throw new BadRequestException('A field with this name already exists');
    return this.prisma.customField.create({
      data: {
        organizationId: BigInt(organizationId),
        name: dto.name,
        fieldType: dto.fieldType,
        defaultValue: dto.defaultValue || null,
        options: dto.options && dto.options.length ? dto.options : undefined,
        showInListing: dto.showInListing ?? true,
        status: dto.status ?? true,
        mandatory: dto.mandatory ?? false,
        createdById: BigInt(userId),
      },
    });
  }

  async update(organizationId: number, id: number, dto: UpdateCustomFieldDto) {
    const field = await this.prisma.customField.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!field) throw new NotFoundException('Custom field not found');
    return this.prisma.customField.update({
      where: { id: field.id },
      data: {
        name: dto.name ?? undefined,
        fieldType: dto.fieldType ?? undefined,
        defaultValue: dto.defaultValue !== undefined ? dto.defaultValue : undefined,
        options: dto.options !== undefined ? dto.options : undefined,
        showInListing: dto.showInListing ?? undefined,
        status: dto.status ?? undefined,
        mandatory: dto.mandatory ?? undefined,
      },
    });
  }

  async remove(organizationId: number, id: number) {
    const field = await this.prisma.customField.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!field) throw new NotFoundException('Custom field not found');
    await this.prisma.customField.delete({ where: { id: field.id } });
    return { success: true };
  }
}
