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
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooks: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.webhooks.list(user.organizationId);
  }

  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  create(@CurrentUser() user: any, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.organizationId, dto);
  }

  @Put(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(user.organizationId, +id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.webhooks.remove(user.organizationId, +id);
  }

  @Post(':id/test')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  test(@CurrentUser() user: any, @Param('id') id: string) {
    return this.webhooks.test(user.organizationId, +id);
  }

  @Get(':id/logs')
  logs(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.webhooks.logs(user.organizationId, +id, +page, +limit);
  }
}
