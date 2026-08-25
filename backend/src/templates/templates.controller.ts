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
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private templates: TemplatesService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.templates.list(user.organizationId, category, status, search);
  }

  @Post('sync')
  sync(@CurrentUser() user: any) {
    return this.templates.syncWithRemote(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user.organizationId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(user.organizationId, +id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templates.submit(user.organizationId, +id);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.templates.remove(user.organizationId, +id);
  }
}
