import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [WalletModule, AuditModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
