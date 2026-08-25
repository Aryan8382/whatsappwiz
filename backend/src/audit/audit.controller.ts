import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('action') action?: string,
  ) {
    return this.audit.list(user.organizationId, user.role, +page, +limit, action);
  }

  @Get(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  detail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.audit.detail(+id);
  }
}
