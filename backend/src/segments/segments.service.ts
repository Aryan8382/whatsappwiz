import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateSegmentDto, FilterConditionDto } from './dto/segment.dto';

@Injectable()
export class SegmentsService {
  constructor(private prisma: PrismaService) {}

  /** Safely parse filters — handles null, array, or JSON string */
  private parseFilters(raw: any): FilterConditionDto[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  }

  /** Only keep filters that have both a field and a value (or an "empty" operator) */
  private validFilters(filters: FilterConditionDto[]): FilterConditionDto[] {
    return filters.filter(f => {
      if (!f || !f.field) return false;
      const op = (f.operator || '').toLowerCase();
      if (op.includes('empty')) return true;
      return f.value && f.value.trim().length > 0;
    });
  }

  private buildPrismaWhere(organizationId: number, filters: FilterConditionDto[]) {
    const where: any = { organizationId: BigInt(organizationId) };
    const valid = this.validFilters(filters);
    if (valid.length === 0) return where;

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

    for (const f of valid) {
      const dbField = fieldMap[f.field!] || f.field!;
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

    if (AND.length > 0) where.AND = AND;
    return where;
  }

  /** Get live contact count for a segment's filters */
  private async liveCount(organizationId: number, rawFilters: any): Promise<number> {
    try {
      const filters = this.parseFilters(rawFilters);
      const valid = this.validFilters(filters);
      if (valid.length === 0) return 0;
      const where = this.buildPrismaWhere(organizationId, valid);
      return await this.prisma.contact.count({ where });
    } catch {
      return 0;
    }
  }

  async list(organizationId: number, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) where.name = { contains: search };

    const items = await (this.prisma as any).segment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      items.map(async (s: any) => {
        const count = await this.liveCount(organizationId, s.filters);
        return {
          ...s,
          id: Number(s.id),
          organizationId: Number(s.organizationId),
          contactCount: count,
          filters: this.parseFilters(s.filters),
          createdBy: 'Talelight Media',
        };
      }),
    );
  }

  async preview(organizationId: number, filters: FilterConditionDto[]) {
    const valid = this.validFilters(filters);
    if (valid.length === 0) return { items: [], total: 0 };

    const where = this.buildPrismaWhere(organizationId, valid);
    const contacts = await this.prisma.contact.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, lastName: true, mobile: true, email: true, city: true, createdAt: true },
    });
    const total = await this.prisma.contact.count({ where });

    return {
      items: contacts.map(c => ({
        ...c,
        id: Number(c.id),
        name: `${c.firstName} ${c.lastName || ''}`.trim(),
        phoneNumber: c.mobile,
      })),
      total,
    };
  }

  async create(organizationId: number, userId: number, dto: CreateSegmentDto) {
    const filters = this.validFilters(dto.filters || []);
    const count = await this.liveCount(organizationId, filters);

    const created = await (this.prisma as any).segment.create({
      data: {
        organizationId: BigInt(organizationId),
        name: dto.name,
        filters: filters as any,
        contactCount: count,
        createdById: userId ? BigInt(userId) : null,
      },
    });

    return {
      ...created,
      id: Number(created.id),
      organizationId: Number(created.organizationId),
      contactCount: count,
      filters,
    };
  }

  async findOne(organizationId: number, id: number) {
    const seg = await (this.prisma as any).segment.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!seg) throw new NotFoundException('Segment not found');

    const filters = this.parseFilters(seg.filters);
    const count = await this.liveCount(organizationId, filters);

    return {
      ...seg,
      id: Number(seg.id),
      organizationId: Number(seg.organizationId),
      contactCount: count,
      filters,
      createdBy: 'Talelight Media',
    };
  }

  async update(organizationId: number, id: number, dto: CreateSegmentDto) {
    const seg = await (this.prisma as any).segment.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!seg) throw new NotFoundException('Segment not found');

    const filters = this.validFilters(dto.filters || []);
    const count = await this.liveCount(organizationId, filters);

    const updated = await (this.prisma as any).segment.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name || seg.name,
        filters: filters as any,
        contactCount: count,
      },
    });

    return {
      ...updated,
      id: Number(updated.id),
      organizationId: Number(updated.organizationId),
      contactCount: count,
      filters,
    };
  }

  async remove(organizationId: number, id: number) {
    const seg = await (this.prisma as any).segment.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!seg) throw new NotFoundException('Segment not found');
    await (this.prisma as any).segment.delete({ where: { id: BigInt(id) } });
    return { success: true };
  }
}
