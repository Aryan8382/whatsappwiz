import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DndService } from './dnd.service';
import { CreateDndDto } from './dto/dnd.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('DND')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dnd')
export class DndController {
  constructor(private dnd: DndService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.dnd.list(user.organizationId, search);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateDndDto) {
    return this.dnd.create(user.organizationId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dnd.remove(user.organizationId, +id);
  }
}
