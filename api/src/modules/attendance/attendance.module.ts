import { Module } from '@nestjs/common';
import { ConfigDataModule } from '../config/config-data.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

@Module({
  // For the punch policy the check-in path enforces.
  imports: [ConfigDataModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
