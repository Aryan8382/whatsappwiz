import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TemplateLibraryService } from './template-library.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Template Library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('template-library')
export class TemplateLibraryController {
  constructor(private library: TemplateLibraryService) {}

  @Get('filters')
  filters() {
    return this.library.filters();
  }

  @Get()
  search(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('industry') industry?: string,
    @Query('topic') topic?: string,
    @Query('useCase') useCase?: string,
    @Query('language') language?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ) {
    return this.library.search({
      type,
      search,
      industry: industry ? industry.split(',') : undefined,
      topic: topic ? topic.split(',') : undefined,
      useCase: useCase ? useCase.split(',') : undefined,
      language,
      page: +page,
      limit: +limit,
    });
  }
}
