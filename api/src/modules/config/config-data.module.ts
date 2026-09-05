import { Module } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';
import { ConfigDataService } from './config-data.service';
import { ConfigDataController } from './config-data.controller';

@Module({
  controllers: [ConfigDataController],
  providers: [ConfigDataService, AppSettingsService],
  // Attendance reads the punch policy on every check-in, so the service is
  // exported rather than the table being read from two places.
  exports: [ConfigDataService, AppSettingsService],
})
export class ConfigDataModule {}
