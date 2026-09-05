import { Module } from '@nestjs/common';
import { TimeOffService } from './time-off.service';
import { TimeOffController } from './time-off.controller';

@Module({
  controllers: [TimeOffController],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}
