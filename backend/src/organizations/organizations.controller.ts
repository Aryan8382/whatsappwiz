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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgs: OrganizationsService) {}

  @Get()
  @Roles(ROLES.SUPER_ADMIN, ROLES.RESELLER)
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.orgs.list(+page, +limit, search);
  }

  @Post()
  @Roles(ROLES.SUPER_ADMIN, ROLES.RESELLER)
  create(@Body() dto: CreateOrganizationDto, @CurrentUser('sub') userId: number) {
    return this.orgs.create(dto, userId);
  }

  @Get(':id')
  @Roles(ROLES.SUPER_ADMIN)
  get(@Param('id') id: string) {
    return this.orgs.getById(+id);
  }

  @Put(':id')
  @Roles(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.RESELLER)
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(+id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.orgs.remove(+id);
  }
}
