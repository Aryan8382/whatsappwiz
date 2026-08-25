import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private users: UsersService,
  ) {}

  async login(dto: LoginDto, ip: string, device?: string) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.issueTokens(user, ip, device);
  }

  async refresh(dto: RefreshDto, ip: string, device?: string) {
    const session = await this.prisma.loginSession.findFirst({
      where: { refreshToken: dto.refreshToken },
      include: { user: { include: { role: true } } },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = session.user;
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is inactive');
    }
    await this.prisma.loginSession.delete({ where: { id: session.id } });
    return this.issueTokens(user, ip, device);
  }

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.prisma.loginSession.deleteMany({ where: { refreshToken } });
    }
    return { success: true };
  }

  private async issueTokens(
    user: {
      id: bigint;
      email: string;
      organizationId: bigint;
      role: { name: string };
    },
    ip: string,
    device?: string,
  ) {
    const payload = {
      sub: Number(user.id),
      email: user.email,
      organizationId: Number(user.organizationId),
      role: user.role.name,
    };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = randomUUID() + randomUUID();

    const refreshSecret = this.config.get('JWT_REFRESH_SECRET');
    const refreshExpirySeconds = this.parseDuration(
      this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    );
    const refreshJwt = this.jwt.sign(
      { sub: payload.sub, jti: refreshToken },
      { secret: refreshSecret, expiresIn: refreshExpirySeconds },
    );

    await this.prisma.loginSession.create({
      data: {
        userId: user.id,
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + refreshExpirySeconds * 1000),
        ipAddress: ip,
        device: device || null,
      },
    });

    const expiresIn = this.parseDuration(
      this.config.get('JWT_EXPIRES_IN') || '8h',
    );
    return { accessToken, refreshToken: refreshJwt, expiresIn, user: payload };
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 3600;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit] || 3600;
    return n * mult;
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { role: true, organization: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async changePassword(userId: number, current: string, next: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(current, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(next, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.prisma.loginSession.deleteMany({ where: { userId: user.id } });
    return { success: true };
  }
}
