import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface AuditInput {
  organizationId?: number;
  userId?: number;
  action: string;
  entity?: string;
  entityId?: number;
  ip?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId
            ? BigInt(input.organizationId)
            : null,
          userId: input.userId ? BigInt(input.userId) : null,
          action: input.action,
          entity: input.entity || null,
          entityId: input.entityId ? BigInt(input.entityId) : null,
          ipAddress: input.ip || null,
          metadata: (input.metadata as any) || undefined,
        },
      });
    } catch {
      // audit logging must never break the main flow
    }
  }

  async list(
    organizationId: number,
    role: string,
    page = 1,
    limit = 50,
    action?: string,
  ) {
    const where: any = {};
    if (role !== 'super_admin' && organizationId) {
      where.organizationId = BigInt(organizationId);
    }
    if (action) where.action = { contains: action };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async detail(id: number) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id: BigInt(id) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    return log;
  }
}
