import { Module } from '@nestjs/common';
import { WabaService } from './waba.service';
import { WabaController } from './waba.controller';

@Module({
  controllers: [WabaController],
  providers: [WabaService],
  exports: [WabaService],
})
export class WabaModule {}
