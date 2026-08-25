import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async generate(organizationId: number) {
    const apiKey = `wiz_${randomUUID().replace(/-/g, '')}`;
    const secret = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const key = await this.prisma.apiKey.create({
      data: {
        organizationId: BigInt(organizationId),
        apiKey,
        secret,
      },
    });
    return {
      id: Number(key.id),
      apiKey,
      secret,
      createdAt: key.createdAt,
      note: 'Store the secret securely — it is shown only once.',
    };
  }

  async list(organizationId: number) {
    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId: BigInt(organizationId) },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      id: Number(k.id),
      apiKey: k.apiKey,
      active: k.active,
      createdAt: k.createdAt,
      secret: undefined,
    }));
  }

  async revoke(organizationId: number, id: number) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id: key.id } });
    return { success: true };
  }

  async validate(apiKey: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { apiKey, active: true },
    });
    if (!key) throw new UnauthorizedException('Invalid API key');
    return {
      organizationId: Number(key.organizationId),
      apiKeyId: Number(key.id),
    };
  }
}
