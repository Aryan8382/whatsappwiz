import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { ConnectWabaDto } from './dto/waba.dto';

@Injectable()
export class WabaService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  getOAuthUrl(organizationId: number) {
    const frontend = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
    return {
      authorizationUrl: `${frontend}/waba/authorize?organizationId=${organizationId}`,
      state: randomUUID(),
    };
  }

  async mockBusinesses() {
    return [
      { id: 'BUS-001', name: 'Acme Pvt Ltd', verified: true, status: 'ACTIVE' },
      { id: 'BUS-002', name: 'Acme Digital Agency', verified: true, status: 'ACTIVE' },
      { id: 'BUS-003', name: 'Acme Enterprise', verified: false, status: 'PENDING' },
    ];
  }

  async mockWabas(businessId: string) {
    const map: Record<string, any[]> = {
      'BUS-001': [
        { id: 'WABA-001', businessId, name: 'Acme Main WABA', currency: 'INR' },
        { id: 'WABA-002', businessId, name: 'Acme Marketing WABA', currency: 'INR' },
      ],
      'BUS-002': [
        { id: 'WABA-003', businessId, name: 'Agency Client WABA', currency: 'INR' },
      ],
      'BUS-003': [],
    };
    return map[businessId] || [];
  }

  async mockNumbers(wabaId: string) {
    const map: Record<string, any[]> = {
      'WABA-001': [
        { id: 'PHONE-001', wabaId, phoneNumber: '+919876543210', displayName: 'Acme Support' },
        { id: 'PHONE-002', wabaId, phoneNumber: '+919876543211', displayName: 'Acme Sales' },
      ],
      'WABA-002': [
        { id: 'PHONE-003', wabaId, phoneNumber: '+919876543212', displayName: 'Acme Marketing' },
      ],
      'WABA-003': [
        { id: 'PHONE-004', wabaId, phoneNumber: '+919876543213', displayName: 'Agency Client Support' },
      ],
    };
    return map[wabaId] || [];
  }

  async connect(organizationId: number, dto: ConnectWabaDto) {
    if (!dto.businessId || !dto.wabaId || !dto.phoneNumberId) {
      throw new BadRequestException('businessId, wabaId and phoneNumberId are required');
    }
    const existing = await this.prisma.wabaAccount.findFirst({
      where: { organizationId: BigInt(organizationId), wabaId: dto.wabaId },
    });
    if (existing) {
      throw new BadRequestException('This WABA is already connected');
    }
    const webhookSecret = randomUUID().replace(/-/g, '');
    const waba = await this.prisma.wabaAccount.create({
      data: {
        organizationId: BigInt(organizationId),
        businessId: dto.businessId,
        wabaId: dto.wabaId,
        accessToken: `EAAG${randomUUID().replace(/-/g, '').slice(0, 32)}`,
        tokenExpiry: new Date(Date.now() + 90 * 86400000),
        qualityRating: 'GREEN',
        status: 'connected',
        webhookSecret,
      },
    });
    const number = await this.prisma.whatsappNumber.create({
      data: {
        organizationId: BigInt(organizationId),
        wabaAccountId: waba.id,
        phoneNumber: dto.phoneNumber,
        phoneNumberId: dto.phoneNumberId,
        displayName: dto.displayName || 'WhatsApp Number',
        verificationStatus: 'verified',
        qualityRating: 'GREEN',
      },
    });
    return { waba, number, webhookSecret };
  }

  async status(organizationId: number) {
    const wabas = await this.prisma.wabaAccount.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: {
        numbers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return wabas;
  }

  async numbers(organizationId: number) {
    return this.prisma.whatsappNumber.findMany({
      where: { organizationId: BigInt(organizationId) },
      include: { wabaAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async disconnect(organizationId: number, wabaId: number) {
    const waba = await this.prisma.wabaAccount.findFirst({
      where: { id: BigInt(wabaId), organizationId: BigInt(organizationId) },
    });
    if (!waba) throw new NotFoundException('WABA not found');
    await this.prisma.wabaAccount.update({
      where: { id: waba.id },
      data: { status: 'disconnected' },
    });
    return { success: true };
  }

  async regenerateWebhookSecret(organizationId: number, wabaId: number) {
    const waba = await this.prisma.wabaAccount.findFirst({
      where: { id: BigInt(wabaId), organizationId: BigInt(organizationId) },
    });
    if (!waba) throw new NotFoundException('WABA not found');
    const webhookSecret = randomUUID().replace(/-/g, '');
    await this.prisma.wabaAccount.update({
      where: { id: waba.id },
      data: { webhookSecret },
    });
    return { webhookSecret };
  }
}
