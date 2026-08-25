import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('role') role?: string,
  ) {
    return this.users.list(user.organizationId, +page, +limit, role);
  }

  @Get('roles')
  roles(@CurrentUser() user: any) {
    return this.users.roles(user.organizationId);
  }

  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.RESELLER)
  create(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
    return this.users.create(user.organizationId, dto);
  }

  @Put(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user.organizationId, +id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.users.remove(user.organizationId, +id);
  }
}
