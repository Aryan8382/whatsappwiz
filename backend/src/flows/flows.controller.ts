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
import { FlowsService } from './flows.service';
import { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('WhatsApp Flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('flows')
export class FlowsController {
  constructor(private flows: FlowsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.flows.list(user.organizationId, search);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.flows.get(user.organizationId, +id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateFlowDto) {
    return this.flows.create(user.organizationId, user.sub, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.flows.update(user.organizationId, +id, dto);
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.flows.publish(user.organizationId, +id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.flows.remove(user.organizationId, +id);
  }
}
