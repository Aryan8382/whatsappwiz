import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const EXPIRY_DAYS = 30; // WhatsApp media links are only valid for ~30 days

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  private decorate(m: any) {
    const ageMs = Date.now() - new Date(m.createdAt).getTime();
    const expired = ageMs > EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    return {
      ...m,
      status: expired ? 'expired' : 'active',
      createdByName: m.createdBy
        ? `${m.createdBy.firstName} ${m.createdBy.lastName || ''}`.trim()
        : null,
    };
  }

  async list(organizationId: number, search?: string) {
    const where: any = { organizationId: BigInt(organizationId) };
    if (search) where.name = { contains: search };
    const items = await this.prisma.media.findMany({
      where,
      include: { createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const decorated = items.map((m) => this.decorate(m));
    return { items: decorated, total: decorated.length };
  }

  async create(
    organizationId: number,
    userId: number,
    file: { originalname: string; mimetype: string; size: number; url: string },
  ) {
    const mediaId = `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const media = await this.prisma.media.create({
      data: {
        organizationId: BigInt(organizationId),
        mediaId,
        name: file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, ''),
        mimeType: file.mimetype,
        size: BigInt(file.size),
        url: file.url,
        createdById: BigInt(userId),
      },
    });
    return this.decorate(media);
  }

  async remove(organizationId: number, id: number) {
    const media = await this.prisma.media.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
    });
    if (!media) throw new NotFoundException('Media not found');
    await this.prisma.media.delete({ where: { id: media.id } });
    return { success: true };
  }
}
