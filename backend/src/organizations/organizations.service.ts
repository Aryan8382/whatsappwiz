import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
  ) {}

  async create(dto: CreateOrganizationDto, createdBy?: number) {
    const base = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let slug = base;
    let i = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        email: dto.email || null,
        phone: dto.phone || null,
        website: dto.website || null,
        timezone: dto.timezone || 'Asia/Kolkata',
        currency: dto.currency || 'INR',
      },
    });
    await this.createDefaultRoles(org.id);
    await this.wallet.ensureWallet(Number(org.id));
    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: createdBy ? BigInt(createdBy) : null,
        action: 'organization.created',
        entity: 'Organization',
        entityId: org.id,
      },
    });
    return org;
  }

  private async createDefaultRoles(organizationId: bigint) {
    const definitions: { name: string; description: string }[] = [
      { name: 'org_admin', description: 'Organization administrator' },
      { name: 'supervisor', description: 'Supervises agents' },
      { name: 'agent', description: 'Handles conversations' },
      { name: 'reseller', description: 'Manages client organizations' },
    ];
    for (const def of definitions) {
      await this.prisma.role.create({
        data: {
          organizationId,
          name: def.name,
          description: def.description,
        },
      });
    }
  }

  async list(page = 1, limit = 50, search?: string) {
    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { slug: { contains: search } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);
    const withStats = await Promise.all(
      items.map(async (org) => {
        const [users, numbers, balance] = await Promise.all([
          this.prisma.user.count({
            where: { organizationId: org.id, status: 'active' },
          }),
          this.prisma.whatsappNumber.count({ where: { organizationId: org.id } }),
          this.prisma.wallet
            .findUnique({ where: { organizationId: org.id } })
            .then((w) => (w ? w.balance : 0)),
        ]);
        return { ...org, userCount: users, numberCount: numbers, walletBalance: balance };
      }),
    );
    return { items: withStats, total, page, limit };
  }

  async getById(id: number) {
    const org = await this.prisma.organization.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const [users, numbers, contacts, conversations, wallet, templates, campaigns] =
      await Promise.all([
        this.prisma.user.count({ where: { organizationId: org.id } }),
        this.prisma.whatsappNumber.count({ where: { organizationId: org.id } }),
        this.prisma.contact.count({ where: { organizationId: org.id } }),
        this.prisma.conversation.count({ where: { organizationId: org.id } }),
        this.prisma.wallet.findUnique({ where: { organizationId: org.id } }),
        this.prisma.template.count({ where: { organizationId: org.id } }),
        this.prisma.campaign.count({ where: { organizationId: org.id } }),
      ]);
    return {
      ...org,
      stats: {
        users,
        numbers,
        contacts,
        conversations,
        templates,
        campaigns,
        walletBalance: wallet?.balance || 0,
        walletCurrency: wallet?.currency || 'INR',
      },
    };
  }

  async update(id: number, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.prisma.organization.update({
      where: { id: org.id },
      data: {
        name: dto.name !== undefined ? dto.name : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        phone: dto.phone !== undefined ? dto.phone : undefined,
        website: dto.website !== undefined ? dto.website : undefined,
        logo: dto.logo !== undefined ? dto.logo : undefined,
        timezone: dto.timezone !== undefined ? dto.timezone : undefined,
        currency: dto.currency !== undefined ? dto.currency : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
      },
    });
  }

  async remove(id: number) {
    const org = await this.prisma.organization.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.slug === 'demo') {
      throw new BadRequestException('The demo organization cannot be deleted');
    }
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { deletedAt: new Date(), status: 'suspended' },
    });
    return { success: true };
  }
}
