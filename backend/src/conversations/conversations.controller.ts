import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssignDto, LabelDto, NoteDto, SetStatusDto } from './dto/conversation.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private conversations: ConversationsService) {}

  @Get()
  list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('agent') agent?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.conversations.list(user.organizationId, {
      status,
      assignedAgentId: agent,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Get('labels')
  labels(@CurrentUser() user: any) {
    return this.conversations.labels(user.organizationId);
  }

  @Post('labels')
  createLabel(@CurrentUser() user: any, @Body() dto: LabelDto) {
    return this.conversations.createLabel(user.organizationId, dto.label!, dto.color);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversations.get(user.organizationId, +id);
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.conversations.assign(user.organizationId, +id, dto.agentId);
  }

  @Post(':id/transfer')
  transfer(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AssignDto,
  ) {
    return this.conversations.transfer(user.organizationId, +id, dto.agentId);
  }

  @Post(':id/status')
  setStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.conversations.setStatus(user.organizationId, +id, dto.status);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: NoteDto,
  ) {
    return this.conversations.addNote(user.organizationId, +id, user.sub, dto.note);
  }

  @Get(':id/notes')
  notes(@CurrentUser() user: any, @Param('id') id: string) {
    return this.conversations.notes(user.organizationId, +id);
  }

  @Post(':id/labels')
  assignLabel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: LabelDto,
  ) {
    return this.conversations.assignLabel(user.organizationId, +id, dto.labelId!);
  }

  @Delete(':id/labels/:labelId')
  unassignLabel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('labelId') labelId: string,
  ) {
    return this.conversations.unassignLabel(user.organizationId, +id, +labelId);
  }
}
