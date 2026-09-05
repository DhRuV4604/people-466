import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EmployeesModule } from './modules/employees/employees.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TimeOffModule } from './modules/time-off/time-off.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ConfigDataModule } from './modules/config/config-data.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FilesModule } from './modules/files/files.module';
import { AiModule } from './modules/ai/ai.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    ContractsModule,
    AttendanceModule,
    TimeOffModule,
    PayrollModule,
    ConfigDataModule,
    DashboardModule,
    NotificationsModule,
    FilesModule,
    AiModule,
    DocumentsModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [
    // Authentication runs first and applies to every route unless marked @Public,
    // so a new endpoint is closed by default rather than accidentally exposed.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
