import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EmailClient } from '@azure/communication-email';
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

/** How a message actually leaves, decided by what is configured. */
type Transport = 'acs' | 'smtp' | 'outbox';

/**
 * Payslip delivery.
 *
 * Three ways out, picked by configuration rather than a flag: Azure
 * Communication Services when it has a connection string, SMTP when it has a
 * host, and otherwise nothing — the attempt is recorded in the in-app outbox
 * so the bulk-send flow is demonstrable without credentials.
 *
 * Whichever is used, the payslip PDF is attached. Recording a delivery without
 * one would tell the payroll team a payslip had gone out when it had not.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Built on first use and reused: each client opens its own connection. */
  private acs?: EmailClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService
  ) {}

  /**
   * ACS wins where both are set: it is the deliberate choice, SMTP the older
   * fallback.
   */
  private transport(): Transport {
    if (this.config.get<string>('mail.acsConnectionString')?.trim()) return 'acs';
    if (this.config.get<string>('mail.host')?.trim()) return 'smtp';
    return 'outbox';
  }

  /** Whether a send would actually leave the building. */
  isDeliveryConfigured(): boolean {
    return this.transport() !== 'outbox';
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

        // Generated before sending, so a payslip that cannot be rendered fails
        // here rather than arriving as an email with nothing attached.
        const { buffer, filename } = await this.pdf.generatePayslip(payslip.id);
        const attachment = { filename, content: buffer };

        const transport = this.transport();
        if (transport === 'acs') {
          await this.sendViaAcs({ to: employee.workEmail, name: employeeName, subject, body, attachment });
        } else if (transport === 'smtp') {
          await this.sendViaSmtp({ to: employee.workEmail, subject, body, attachment });
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
    attachment: { filename: string; content: Buffer };
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
      attachments: [
        { filename: params.attachment.filename, content: params.attachment.content },
      ],
    });
  }

  /**
   * Azure Communication Services.
   *
   * `beginSend` returns a poller: the promise resolving only means Azure
   * accepted the message. Waiting for the operation to finish is what turns a
   * rejected sender address or a bad recipient into a failure this method can
   * report, rather than a silent non-delivery recorded as SENT.
   */
  private async sendViaAcs(params: {
    to: string;
    name: string;
    subject: string;
    body: string;
    attachment: { filename: string; content: Buffer };
  }): Promise<void> {
    const senderAddress = this.config.get<string>('mail.acsSenderAddress')?.trim();
    if (!senderAddress) {
      throw new Error(
        'ACS_EMAIL_CONNECTION_STRING is set but ACS_SENDER_ADDRESS is not. It must be a verified sender on the ACS domain.'
      );
    }

    this.acs ??= new EmailClient(
      this.config.get<string>('mail.acsConnectionString') as string
    );

    const poller = await this.acs.beginSend({
      senderAddress,
      content: { subject: params.subject, plainText: params.body },
      recipients: { to: [{ address: params.to, displayName: params.name }] },
      attachments: [
        {
          name: params.attachment.filename,
          contentType: 'application/pdf',
          contentInBase64: params.attachment.content.toString('base64'),
        },
      ],
    });

    const result = await poller.pollUntilDone();
    if (result.status !== 'Succeeded') {
      throw new Error(
        `Azure reported the message as ${result.status}${result.error?.message ? `: ${result.error.message}` : ''}`
      );
    }
  }
}
