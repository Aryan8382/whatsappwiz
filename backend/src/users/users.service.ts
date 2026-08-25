import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { ROLES } from '../common/types';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true },
    });
  }

  async list(organizationId: number, page = 1, limit = 50, role?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (role) {
      const r = await this.prisma.role.findFirst({
        where: { organizationId: BigInt(organizationId), name: role },
      });
      if (r) where.roleId = r.id;
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ passwordHash, ...u }) => u),
      total,
      page,
      limit,
    };
  }

  async roles(organizationId: number) {
    return this.prisma.role.findMany({
      where: { organizationId: BigInt(organizationId) },
      orderBy: { id: 'asc' },
    });
  }

  async create(
    organizationId: number,
    dto: CreateUserDto,
    opts?: { skipRoleCheck?: boolean; inviteBy?: number },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: BigInt(organizationId) },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const role = await this.prisma.role.findFirst({
      where: { organizationId: BigInt(organizationId), id: BigInt(dto.roleId) },
    });
    if (!role) throw new BadRequestException('Invalid role for organization');

    if (!opts?.skipRoleCheck && role.name === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign super admin role');
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password || 'Welcome@123', 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId: BigInt(organizationId),
        roleId: role.id,
        firstName: dto.firstName,
        lastName: dto.lastName || '',
        email,
        mobile: dto.mobile || null,
        passwordHash,
        status: dto.status || 'active',
      },
      include: { role: true },
    });
    const { passwordHash: _pw, ...safe } = user;
    return safe;
  }

  async update(
    organizationId: number,
    userId: number,
    dto: UpdateUserDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), organizationId: BigInt(organizationId) },
    });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.mobile !== undefined) data.mobile = dto.mobile;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { organizationId: BigInt(organizationId), id: BigInt(dto.roleId) },
      });
      if (!role) throw new BadRequestException('Invalid role');
      data.roleId = role.id;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { role: true },
    });
    const { passwordHash: _pw, ...safe } = updated;
    return safe;
  }

  async remove(organizationId: number, userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), organizationId: BigInt(organizationId) },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'inactive' },
    });
    return { success: true };
  }
}
