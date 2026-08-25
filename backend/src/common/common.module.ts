import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  providers: [PrismaService, JwtAuthGuard, RolesGuard],
  exports: [PrismaService, JwtAuthGuard, RolesGuard],
})
export class CommonModule {}
