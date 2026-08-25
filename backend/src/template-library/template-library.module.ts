import { Module } from '@nestjs/common';
import { TemplateLibraryService } from './template-library.service';
import { TemplateLibraryController } from './template-library.controller';

@Module({
  controllers: [TemplateLibraryController],
  providers: [TemplateLibraryService],
})
export class TemplateLibraryModule {}
