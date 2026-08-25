import { Module } from '@nestjs/common';
import { DndService } from './dnd.service';
import { DndController } from './dnd.controller';

@Module({
  controllers: [DndController],
  providers: [DndService],
  exports: [DndService],
})
export class DndModule {}
