import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailLogDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber } from '../../common/decimal';
import { PdfService } from './pdf.service';

export interface SendResult {
  sent: number;
  failed: number;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Payslip delivery.
 *
 * With no SMTP host configured the message is recorded in the in-app outbox
 * instead of dialling out, so the bulk-send flow is demonstrable without
 * credentials. Setting SMTP_HOST switches to real sending.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService
  ) {}

  isSmtpConfigured(): boolean {
    return Boolean(this.config.get<string>('mail.host')?.trim());
  }

  private buildBody(params: {
    employeeName: string;
    periodStart: Date;
    periodEnd: Date;
    netPay: number;
    payslipNumber: string;
  }): string {
    return [
      `Dear ${params.employeeName},`,
      '',
      `Please find attached your payslip for the period ${formatDate(params.periodStart)} to ${formatDate(params.periodEnd)}.`,
      '',
      `Payslip Number: ${params.payslipNumber}`,
      `Net Pay: ${params.netPay.toFixed(2)}`,
      '',
      'If any detail looks incorrect, please contact the payroll team.',
      '',
      'Regards,',
      'Payroll Team - PeoplePay360',
    ].join('\n');
  }

  async sendPayrunPayslips(payrunId: string): Promise<SendResult> {
    const payrun = await this.prisma.payrun.findUnique({
      where: { id: payrunId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!payrun) throw new NotFoundException('Pay run not found.');

    const result: SendResult = { sent: 0, failed: 0 };

    for (const payslip of payrun.payslips) {
      const employee = payslip.employee;
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const subject = `Payslip ${payslip.number} - ${formatDate(payslip.periodStart)} to ${formatDate(payslip.periodEnd)}`;
      const body = this.buildBody({
        employeeName,
        periodStart: payslip.periodStart,
        periodEnd: payslip.periodEnd,
        netPay: toNumber(payslip.netPay),
        payslipNumber: payslip.number,
      });

      try {
        if (!employee.workEmail) throw new Error('Employee has no work email address.');

        // Generating the PDF proves the attachment is producible before we
        // record the message as delivered.
        const { filename } = await this.pdf.generatePayslip(payslip.id);

        if (this.isSmtpConfigured()) {
          await this.sendViaSmtp({ to: employee.workEmail, subject, body });
        }

        await this.prisma.emailLog.create({
          data: {
            payslipId: payslip.id,
            payrunId: payrun.id,
            toEmail: employee.workEmail,
            toName: employeeName,
            subject,
            body,
            attachmentName: filename,
            status: 'SENT',
          },
        });

        result.sent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Payslip delivery failed for ${employeeName}: ${message}`);

        await this.prisma.emailLog.create({
          data: {
            payslipId: payslip.id,
            payrunId: payrun.id,
            toEmail: employee.workEmail ?? 'unknown',
            toName: employeeName,
            subject,
            body,
            status: 'FAILED',
            error: message,
          },
        });

        result.failed += 1;
      }
    }

    return result;
  }

  async findLogs(): Promise<EmailLogDto[]> {
    const logs = await this.prisma.emailLog.findMany({
      include: { payrun: { select: { id: true, name: true } } },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });

    return logs.map((e) => ({
      id: e.id,
      payslipId: e.payslipId,
      payrunId: e.payrunId,
      payrun: e.payrun,
      toEmail: e.toEmail,
      toName: e.toName,
      subject: e.subject,
      attachmentName: e.attachmentName,
      status: e.status,
      error: e.error,
      sentAt: e.sentAt.toISOString(),
    }));
  }

  /**
   * Real SMTP delivery. Nodemailer is resolved at runtime so the optional
   * dependency is only required when SMTP is actually configured.
   */
  private async sendViaSmtp(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<void> {
    const nodemailer = await import('nodemailer' as string).catch(() => null);
    if (!nodemailer) {
      throw new Error('SMTP_HOST is set but nodemailer is not installed. Run: npm i nodemailer');
    }

    const port = this.config.get<number>('mail.port') ?? 587;
    const user = this.config.get<string>('mail.user');
    const password = this.config.get<string>('mail.password');

    const transport = (nodemailer.default ?? nodemailer).createTransport({
      host: this.config.get<string>('mail.host'),
      port,
      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
    });

    await transport.sendMail({
      from: this.config.get<string>('mail.from'),
      to: params.to,
      subject: params.subject,
      text: params.body,
    });
  }
}
