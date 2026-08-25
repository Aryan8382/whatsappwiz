import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { RechargeDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  balance(@CurrentUser() user: any) {
    return this.wallet.getWallet(user.organizationId);
  }

  @Post('recharge')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.RESELLER)
  recharge(@CurrentUser() user: any, @Body() dto: RechargeDto) {
    return this.wallet.recharge(user.organizationId, dto.amount, dto.method || 'manual');
  }

  @Get('transactions')
  transactions(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.wallet.transactions(user.organizationId, +page, +limit);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: any) {
    return this.wallet.invoices(user.organizationId);
  }

  @Get('invoices/:id')
  invoice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.wallet.invoiceDetail(+id);
  }
}
