import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * Global because notifications are raised from wherever something happens -
 * time off, payroll, employees - and threading an import through every one of
 * those modules only records that a cross-cutting concern is cross-cutting.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
