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
import { SegmentsService } from './segments.service';
import { CreateSegmentDto, PreviewSegmentDto } from './dto/segment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';

@ApiTags('Segments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('segments')
export class SegmentsController {
  constructor(private segments: SegmentsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.segments.list(user.organizationId, search);
  }

  @Post('preview')
  preview(@CurrentUser() user: any, @Body() dto: PreviewSegmentDto) {
    return this.segments.preview(user.organizationId, dto.filters || []);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.segments.findOne(user.organizationId, +id);
  }

  @Post()
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  create(@CurrentUser() user: any, @Body() dto: CreateSegmentDto) {
    return this.segments.create(user.organizationId, user.userId, dto);
  }

  @Put(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN, ROLES.SUPERVISOR)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.segments.update(user.organizationId, +id, dto);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.segments.remove(user.organizationId, +id);
  }
}
