import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: any) {
    return this.reports.dashboard(user.organizationId);
  }

  @Get('messages')
  messages(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.messages(user.organizationId, from, to);
  }

  @Get('campaigns')
  campaigns(@CurrentUser() user: any) {
    return this.reports.campaigns(user.organizationId);
  }

  @Get('agents')
  agents(@CurrentUser() user: any) {
    return this.reports.agents(user.organizationId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=report.csv')
  export(@CurrentUser() user: any, @Query('type') type = 'messages') {
    return this.reports.exportCsv(user.organizationId, type);
  }
}
