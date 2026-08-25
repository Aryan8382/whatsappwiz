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
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/custom-field.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Custom Fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private customFields: CustomFieldsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.customFields.list(user.organizationId, search);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCustomFieldDto) {
    return this.customFields.create(user.organizationId, user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
  ) {
    return this.customFields.update(user.organizationId, +id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customFields.remove(user.organizationId, +id);
  }
}
