import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('API Keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('apikeys')
export class ApiKeysController {
  constructor(private apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.apiKeys.list(user.organizationId);
  }

  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.RESELLER)
  generate(@CurrentUser() user: any) {
    return this.apiKeys.generate(user.organizationId);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  revoke(@CurrentUser() user: any, @Param('id') id: string) {
    return this.apiKeys.revoke(user.organizationId, +id);
  }
}
