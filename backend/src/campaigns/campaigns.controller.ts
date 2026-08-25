import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaign.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.campaigns.list(user.organizationId, status, search);
  }

  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  create(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.organizationId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.get(user.organizationId, +id);
  }

  @Post(':id/start')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  start(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.start(user.organizationId, +id);
  }

  @Post(':id/pause')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  pause(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.pause(user.organizationId, +id);
  }

  @Post(':id/resume')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  resume(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.resume(user.organizationId, +id);
  }

  @Get(':id/analytics')
  analytics(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.analytics(user.organizationId, +id);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.campaigns.remove(user.organizationId, +id);
  }
}
