import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatbotsService } from './chatbots.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLES } from '../common/types';
import {
  AddNodeDto,
  ConnectDto,
  CreateFlowDto,
  UpdateBotConfigDto,
  UpdateFlowDto,
  UpdateNodeDto,
} from './dto/chatbot.dto';

@ApiTags('Chatbots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bots')
export class ChatbotsController {
  constructor(private chatbots: ChatbotsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.chatbots.list(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateFlowDto) {
    return this.chatbots.create(user.organizationId, user.sub, dto.name);
  }

  @Get(':id')
  get(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatbots.get(user.organizationId, +id);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.chatbots.update(user.organizationId, +id, dto);
  }


  @Get(':id/preview')
  preview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatbots.preview(user.organizationId, +id);
  }

  @Post(':id/nodes')
  addNode(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AddNodeDto) {
    return this.chatbots.addNode(
      user.organizationId,
      +id,
      dto.nodeType,
      dto.config,
      dto.positionX,
      dto.positionY,
    );
  }

  @Put(':id/nodes/:nodeId')
  updateNode(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.chatbots.updateNode(user.organizationId, +id, +nodeId, dto);
  }

  @Delete(':id/nodes/:nodeId')
  deleteNode(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.chatbots.deleteNode(user.organizationId, +id, +nodeId);
  }

  @Post(':id/connections')
  connect(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConnectDto) {
    return this.chatbots.connect(user.organizationId, +id, dto.sourceNode, dto.targetNode);
  }

  @Delete(':id/connections/:sourceNode/:targetNode')
  disconnect(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('sourceNode') sourceNode: string,
    @Param('targetNode') targetNode: string,
  ) {
    return this.chatbots.disconnect(user.organizationId, +id, +sourceNode, +targetNode);
  }

  @Patch(':id/config')
  updateConfigPatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBotConfigDto,
  ) {
    return this.chatbots.updateConfig(user.organizationId, +id, dto.config);
  }

  @Put(':id/config')
  updateConfigPut(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBotConfigDto,
  ) {
    return this.chatbots.updateConfig(user.organizationId, +id, dto.config);
  }

  @Post(':id/publish')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  publish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatbots.publish(user.organizationId, +id);
  }

  @Post(':id/unpublish')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  unpublish(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatbots.unpublish(user.organizationId, +id);
  }

  @Delete(':id')
  @Roles(ROLES.ORG_ADMIN, ROLES.SUPER_ADMIN)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatbots.remove(user.organizationId, +id);
  }
}
