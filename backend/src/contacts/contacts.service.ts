import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../common/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async list(
    organizationId: number,
    page = 1,
    limit = 20,
    search?: string,
    tagId?: string,
  ) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { mobile: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (tagId) {
      where.contactTags = { some: { tagId: BigInt(tagId) } };
    }
    const [items, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: {
          contactTags: { include: { tag: true } },
          conversations: { select: { id: true, status: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);
    return {
      items: items.map(({ contactTags, conversations, ...c }) => ({
        ...c,
        id: Number(c.id),
        organizationId: Number(c.organizationId),
        tags: contactTags.map((ct) => ({
          ...ct.tag,
          id: Number(ct.tag.id),
          organizationId: Number(ct.tag.organizationId),
        })),
        conversationCount: conversations.length,
      })),
      total,
      page,
      limit,
    };
  }

  async findOrCreateByMobile(organizationId: number, mobile: string, firstName?: string) {
    let contact = await this.prisma.contact.findFirst({
      where: { organizationId: BigInt(organizationId), mobile },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          organizationId: BigInt(organizationId),
          firstName: firstName || mobile,
          mobile,
        },
      });
    }
    return {
      ...contact,
      id: Number(contact.id),
      organizationId: Number(contact.organizationId),
    };
  }

  async create(organizationId: number, dto: CreateContactDto) {
    const existing = await this.prisma.contact.findFirst({
      where: { organizationId: BigInt(organizationId), mobile: dto.mobile },
    });
    if (existing) throw new BadRequestException('Contact with this mobile already exists');
    const created = await this.prisma.contact.create({
      data: {
        organizationId: BigInt(organizationId),
        firstName: dto.firstName,
        lastName: dto.lastName || null,
        mobile: dto.mobile,
        email: dto.email || null,
        city: dto.city || null,
        state: dto.state || null,
        country: dto.country || null,
        optIn: dto.optIn !== undefined ? dto.optIn : true,
        source: dto.source || 'manual',
        contactTags: dto.tagIds?.length
          ? { create: dto.tagIds.map((id) => ({ tagId: BigInt(id) })) }
          : undefined,
      },
      include: { contactTags: { include: { tag: true } } },
    });
    return {
      ...created,
      id: Number(created.id),
      organizationId: Number(created.organizationId),
      tags: created.contactTags?.map((ct) => ({
        ...ct.tag,
        id: Number(ct.tag.id),
        organizationId: Number(ct.tag.organizationId),
      })) || [],
    };
  }

  async update(organizationId: number, id: number, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    if (dto.tagIds) {
      await this.prisma.contactTag.deleteMany({ where: { contactId: contact.id } });
    }
    const updated = await this.prisma.contact.update({
      where: { id: contact.id },
      data: {
        firstName: dto.firstName !== undefined ? dto.firstName : undefined,
        lastName: dto.lastName !== undefined ? dto.lastName : undefined,
        mobile: dto.mobile !== undefined ? dto.mobile : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        city: dto.city !== undefined ? dto.city : undefined,
        state: dto.state !== undefined ? dto.state : undefined,
        country: dto.country !== undefined ? dto.country : undefined,
        optIn: dto.optIn !== undefined ? dto.optIn : undefined,
        source: dto.source !== undefined ? dto.source : undefined,
        contactTags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tid) => ({ tagId: BigInt(tid) })) }
          : undefined,
      },
      include: { contactTags: { include: { tag: true } } },
    });
    return {
      ...updated,
      id: Number(updated.id),
      organizationId: Number(updated.organizationId),
      tags: updated.contactTags?.map((ct) => ({
        ...ct.tag,
        id: Number(ct.tag.id),
        organizationId: Number(ct.tag.organizationId),
      })) || [],
    };
  }

  async remove(organizationId: number, id: number) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    await this.prisma.contact.delete({ where: { id: contact.id } });
    return { success: true };
  }

  async importCsv(organizationId: number, buffer: Buffer) {
    const content = buffer.toString('utf-8');
    let records: any[];
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      throw new BadRequestException('Invalid CSV file format');
    }

    let imported = 0;
    let skipped = 0;
    for (const row of records) {
      const mobile = (row.mobile || row.phone || row.Mobile || row.Phone || '')
        .toString()
        .trim()
        .replace(/[^+\d]/g, '');
      if (!mobile) {
        skipped++;
        continue;
      }
      const firstName =
        row.firstName || row.name || row.Name || row.FirstName || mobile;
      const lastName = row.lastName || row.LastName || '';
      const email = row.email || row.Email || null;
      const city = row.city || row.City || null;

      const existing = await this.prisma.contact.findFirst({
        where: { organizationId: BigInt(organizationId), mobile },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await this.prisma.contact.create({
        data: {
          organizationId: BigInt(organizationId),
          firstName: String(firstName),
          lastName: lastName ? String(lastName) : null,
          mobile,
          email: email ? String(email) : null,
          city: city ? String(city) : null,
          source: 'csv-import',
        },
      });
      imported++;
    }
    return { imported, skipped, total: records.length };
  }

  async export(organizationId: number) {
    const contacts = await this.prisma.contact.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: { contactTags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'name,mobile,email,city,opt_in,tags,last_interaction';
    const rows = contacts.map((c) => {
      const name = `${c.firstName} ${c.lastName || ''}`.trim();
      const tags = c.contactTags.map((ct) => ct.tag.name).join('|');
      const cells = [
        name,
        c.mobile,
        c.email || '',
        c.city || '',
        c.optIn ? 'true' : 'false',
        tags,
        c.lastInteraction ? c.lastInteraction.toISOString() : '',
      ];
      return cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    return [header, ...rows].join('\n');
  }

  async tags(organizationId: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id: BigInt(organizationId) },
      select: { name: true },
    });
    const orgName = org?.name || 'Talelight Media';

    const tags = await this.prisma.tag.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: {
        _count: { select: { contactTags: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      id: Number(tag.id),
      contactCount: _count.contactTags,
      createdByName: orgName,
      createdBy: orgName,
    }));
  }

  async getTagContacts(
    organizationId: number,
    tagId: number,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: BigInt(tagId), organizationId: BigInt(organizationId) },
    });
    if (!tag) throw new NotFoundException('Tag not found');

    const where: any = {
      organizationId: BigInt(organizationId),
      contactTags: { some: { tagId: BigInt(tagId) } },
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { mobile: { contains: search } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      tag: { id: Number(tag.id), name: tag.name },
      items: contacts.map((c) => ({
        id: Number(c.id),
        name: `${c.firstName} ${c.lastName || ''}`.trim() || c.mobile,
        mobile: c.mobile,
        email: c.email,
        city: c.city,
      })),
      total,
      page,
      limit,
    };
  }

  async removeContactFromTag(organizationId: number, tagId: number, contactId: number) {
    await this.prisma.contactTag.deleteMany({
      where: {
        tagId: BigInt(tagId),
        contactId: BigInt(contactId),
        contact: { organizationId: BigInt(organizationId) },
      },
    });
    return { success: true };
  }

  async createTag(organizationId: number, name: string, color?: string) {
    const existing = await this.prisma.tag.findFirst({
      where: { organizationId: BigInt(organizationId), name },
    });
    if (existing) throw new BadRequestException('Tag already exists');
    const tag = await this.prisma.tag.create({
      data: {
        organizationId: BigInt(organizationId),
        name,
        color: color || '#25D366',
      },
    });
    return {
      ...tag,
      id: Number(tag.id),
      createdByName: 'Talelight Media',
      createdBy: 'Talelight Media',
      contactCount: 0,
    };
  }

  async deleteTag(organizationId: number, id: number) {
    const tag = await this.prisma.tag.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id: tag.id } });
    return { success: true };
  }
}
