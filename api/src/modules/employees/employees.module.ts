import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
// Creating an employee creates their sign-in and emails the invite, so this
// module needs the mailer and the PDF service it depends on.
import { MailService } from '../payroll/mail.service';
import { PdfService } from '../payroll/pdf.service';
// Both of those now put the company's own name on what they send, so the
// module that owns the company comes with them.
import { ConfigDataModule } from '../config/config-data.module';

@Module({
  imports: [ConfigDataModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, MailService, PdfService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
