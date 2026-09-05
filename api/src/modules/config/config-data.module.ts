import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { AppSettingsService } from './app-settings.service';
import { ConfigDataService } from './config-data.service';
import { ConfigDataController } from './config-data.controller';

@Module({
  controllers: [ConfigDataController, CompanyController],
  providers: [ConfigDataService, AppSettingsService, CompanyService],
  // Attendance reads the punch policy on every check-in, so the service is
  // exported rather than the table being read from two places.
  exports: [ConfigDataService, AppSettingsService, CompanyService],
})
export class ConfigDataModule {}
