import { Module } from '@nestjs/common';
import { PayrollEngineService } from './payroll-engine.service';
import { PayslipsService } from './payslips.service';
import { PayrunsService } from './payruns.service';
import { SalaryConfigService } from './salary-config.service';
import { PdfService } from './pdf.service';
import { MailService } from './mail.service';
import {
  PayrunsController,
  PayslipsController,
  SalaryConfigController,
} from './payroll.controller';
import { ContractsModule } from '../contracts/contracts.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TimeOffModule } from '../time-off/time-off.module';

@Module({
  imports: [ContractsModule, AttendanceModule, TimeOffModule],
  controllers: [PayrunsController, PayslipsController, SalaryConfigController],
  providers: [
    PayrollEngineService,
    PayslipsService,
    PayrunsService,
    SalaryConfigService,
    PdfService,
    MailService,
  ],
  exports: [PayrollEngineService, PayslipsService, PayrunsService],
})
export class PayrollModule {}
