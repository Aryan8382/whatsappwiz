import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AutomationService } from './automation.service';
import { CreateAutomationDto, UpdateAutomationDto } from './dto/automation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private automation: AutomationService) {}

  @Get('stats')
  stats(@CurrentUser() user: any) {
    return this.automation.stats(user.organizationId);
  }

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.automation.list(user.organizationId, search, status);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.automation.get(user.organizationId, +id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAutomationDto) {
    return this.automation.create(user.organizationId, user.sub, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAutomationDto) {
    return this.automation.update(user.organizationId, +id, dto);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.automation.activate(user.organizationId, +id);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: any, @Param('id') id: string) {
    return this.automation.pause(user.organizationId, +id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.automation.remove(user.organizationId, +id);
  }
}
