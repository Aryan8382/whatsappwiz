import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WabaService } from './waba.service';
import { ConnectWabaDto } from './dto/waba.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('WABA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('waba')
export class WabaController {
  constructor(private waba: WabaService) {}

  @Get('oauth/url')
  oauthUrl(@CurrentUser() user: any) {
    return this.waba.getOAuthUrl(user.organizationId);
  }

  @Get('businesses')
  businesses() {
    return this.waba.mockBusinesses();
  }

  @Get('businesses/:businessId/wabas')
  wabas(@Param('businessId') businessId: string) {
    return this.waba.mockWabas(businessId);
  }

  @Get('wabas/:wabaId/numbers')
  numbersForWaba(@Param('wabaId') wabaId: string) {
    return this.waba.mockNumbers(wabaId);
  }

  @Post('connect')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.RESELLER)
  connect(@CurrentUser() user: any, @Body() dto: ConnectWabaDto) {
    return this.waba.connect(user.organizationId, dto);
  }

  @Get('status')
  status(@CurrentUser() user: any) {
    return this.waba.status(user.organizationId);
  }

  @Get('numbers')
  numbers(@CurrentUser() user: any) {
    return this.waba.numbers(user.organizationId);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  disconnect(@CurrentUser() user: any, @Param('id') id: string) {
    return this.waba.disconnect(user.organizationId, +id);
  }

  @Post(':id/webhook-secret')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  regenerate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.waba.regenerateWebhookSecret(user.organizationId, +id);
  }
}
