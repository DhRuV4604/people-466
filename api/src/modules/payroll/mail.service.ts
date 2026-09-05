import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EmailClient } from '@azure/communication-email';
import { ConfigService } from '@nestjs/config';
import type { EmailLogDto, Paginated } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  pageArgs,
  paginated,
  type PaginationQueryDto,
} from '../../common/pagination';
import { toNumber } from '../../common/decimal';
import { PdfService } from './pdf.service';

export interface SendResult {
  sent: number;
  failed: number;
  /**
   * Written to the outbox but not delivered, because no transport is
   * configured. Counted apart from `sent`: a caller that cannot tell the two
   * apart will tell someone their payslip is on its way when it is not.
   */
  queued: number;
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

  /**
   * Why nothing was delivered, in words an admin can act on.
   *
   * Recording an undelivered message as SENT was the bug this replaces: an
   * install with no mail credentials reported every invite as delivered, so
   * the one person who could fix it had no way to know it was broken.
   */
  private static readonly NO_TRANSPORT =
    'No mail transport is configured, so nothing was delivered. Set ACS_EMAIL_CONNECTION_STRING and ACS_SENDER_ADDRESS, or SMTP_HOST, and send again.';

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

    const result: SendResult = { sent: 0, failed: 0, queued: 0 };

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

        const delivered = transport !== 'outbox';

        await this.prisma.emailLog.create({
          data: {
            payslipId: payslip.id,
            payrunId: payrun.id,
            toEmail: employee.workEmail,
            toName: employeeName,
            subject,
            body,
            attachmentName: filename,
            // QUEUED says what actually happened: written down, not sent.
            status: delivered ? 'SENT' : 'QUEUED',
            error: delivered ? null : MailService.NO_TRANSPORT,
          },
        });

        if (delivered) result.sent += 1;
        else result.queued += 1;
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

  /**
   * The invite that goes out when an account is created.
   *
   * Recorded in the same outbox as a payslip, so "was this person ever asked
   * to sign in" has one place to look. A failure is not thrown: an employee
   * that exists but whose invite bounced is a smaller problem than a create
   * that half happened, and the row says what went wrong.
   */
  async sendInvite(params: {
    to: string;
    name: string;
    password: string;
    signInUrl: string;
  }): Promise<{ delivered: boolean; error?: string }> {
    const subject = 'Your PeoplePay360 account';
    const body = [
      `Hello ${params.name},`,
      '',
      'An account has been created for you on PeoplePay360, where you can check',
      'in and out, request leave and read your payslips.',
      '',
      `Sign in at: ${params.signInUrl}`,
      `Email:      ${params.to}`,
      `Password:   ${params.password}`,
      '',
      'That password works once. You will be asked to choose your own as soon',
      'as you sign in.',
      '',
      'If you were not expecting this, tell your HR team rather than signing in.',
      '',
      'Regards,',
      'PeoplePay360',
    ].join('\n');

    const transport = this.transport();
    let status: 'SENT' | 'QUEUED' | 'FAILED' =
      transport === 'outbox' ? 'QUEUED' : 'SENT';
    let error: string | null =
      transport === 'outbox' ? MailService.NO_TRANSPORT : null;

    try {
      if (transport === 'acs') {
        await this.sendViaAcs({ to: params.to, name: params.name, subject, body });
      } else if (transport === 'smtp') {
        await this.sendViaSmtp({ to: params.to, subject, body });
      }
    } catch (err) {
      status = 'FAILED';
      error = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Invite to ${params.to} failed: ${error}`);
    }

    if (status === 'QUEUED') {
      this.logger.warn(
        `Invite for ${params.to} was not delivered: ${MailService.NO_TRANSPORT}`
      );
    }

    await this.prisma.emailLog
      .create({
        data: {
          toEmail: params.to,
          toName: params.name,
          subject,
          // The password is deliberately not stored: the outbox is readable by
          // anyone with payslips:read, and a credential does not belong there.
          body: body.replace(params.password, '********'),
          status,
          error,
        },
      })
      .catch(() => undefined);

    return { delivered: status === 'SENT', error: error ?? undefined };
  }

  async findLogs(query: PaginationQueryDto = {}): Promise<Paginated<EmailLogDto>> {
    const { skip, take, page, pageSize } = pageArgs(query);

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        include: { payrun: { select: { id: true, name: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.emailLog.count(),
    ]);

    const items = logs.map((e) => ({
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

    return paginated(items, total, page, pageSize);
  }

  /**
   * Real SMTP delivery. Nodemailer is resolved at runtime so the optional
   * dependency is only required when SMTP is actually configured.
   */
  private async sendViaSmtp(params: {
    to: string;
    subject: string;
    body: string;
    /** Absent for mail that carries nothing, such as an invite. */
    attachment?: { filename: string; content: Buffer };
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
      attachments: params.attachment
        ? [{ filename: params.attachment.filename, content: params.attachment.content }]
        : undefined,
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
    /** Absent for mail that carries nothing, such as an invite. */
    attachment?: { filename: string; content: Buffer };
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
      attachments: params.attachment
        ? [
            {
              name: params.attachment.filename,
              contentType: 'application/pdf',
              contentInBase64: params.attachment.content.toString('base64'),
            },
          ]
        : undefined,
    });

    const result = await poller.pollUntilDone();
    if (result.status !== 'Succeeded') {
      throw new Error(
        `Azure reported the message as ${result.status}${result.error?.message ? `: ${result.error.message}` : ''}`
      );
    }
  }
}
