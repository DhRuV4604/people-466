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
import { CompanyService } from '../config/company.service';
import {
  inviteEmail,
  payslipEmail,
  type EmailContent,
} from '../../common/email-template';

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
    private readonly config: ConfigService,
    private readonly company: CompanyService
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

  /**
   * Where in the app a payslip can be read.
   *
   * Derived from the sign-in URL rather than configured separately, so an
   * install that has set CORS_ORIGIN gets a working button without a second
   * setting to get wrong. Undefined when nothing is configured — a button
   * pointing at localhost in someone's inbox is worse than no button.
   */
  private payUrl(): string | undefined {
    const signIn = this.config.get<string>('signInUrl');
    if (!signIn) return undefined;
    return signIn.replace(/\/login\/?$/, '') + '/me/pay';
  }

  async sendPayrunPayslips(payrunId: string): Promise<SendResult> {
    const payrun = await this.prisma.payrun.findUnique({
      where: { id: payrunId },
      include: { payslips: { include: { employee: true } } },
    });
    if (!payrun) throw new NotFoundException('Pay run not found.');

    const result: SendResult = { sent: 0, failed: 0, queued: 0 };
    // Read once rather than per payslip: it is the same row every time, and a
    // pay run is a few hundred of these.
    const company = await this.company.get();
    const payUrl = this.payUrl();

    for (const payslip of payrun.payslips) {
      const employee = payslip.employee;
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const mail = payslipEmail({
        employeeName,
        payslipNumber: payslip.number,
        periodStart: payslip.periodStart,
        periodEnd: payslip.periodEnd,
        netPay: toNumber(payslip.netPay),
        company,
        payUrl,
      });
      const { subject } = mail;
      // The outbox keeps the plain-text alternative, not the markup: it is a
      // record of what was said, and nobody reading it wants a page of tables.
      const body = mail.text;

      try {
        if (!employee.workEmail) throw new Error('Employee has no work email address.');

        // Generated before sending, so a payslip that cannot be rendered fails
        // here rather than arriving as an email with nothing attached.
        const { buffer, filename } = await this.pdf.generatePayslip(payslip.id);
        const attachment = { filename, content: buffer };

        const transport = this.transport();
        if (transport === 'acs') {
          await this.sendViaAcs({ to: employee.workEmail, name: employeeName, mail, attachment });
        } else if (transport === 'smtp') {
          await this.sendViaSmtp({ to: employee.workEmail, mail, attachment });
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
    const company = await this.company.get();
    const mail = inviteEmail({
      name: params.name,
      email: params.to,
      password: params.password,
      signInUrl: params.signInUrl,
      company,
    });
    const { subject } = mail;
    const body = mail.text;

    const transport = this.transport();
    let status: 'SENT' | 'QUEUED' | 'FAILED' =
      transport === 'outbox' ? 'QUEUED' : 'SENT';
    let error: string | null =
      transport === 'outbox' ? MailService.NO_TRANSPORT : null;

    try {
      if (transport === 'acs') {
        await this.sendViaAcs({ to: params.to, name: params.name, mail });
      } else if (transport === 'smtp') {
        await this.sendViaSmtp({ to: params.to, mail });
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
    mail: EmailContent;
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
      subject: params.mail.subject,
      // Both parts, always. A client that will not render HTML — and a spam
      // filter that scores an HTML-only message harder — gets the text one.
      text: params.mail.text,
      html: params.mail.html,
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
    mail: EmailContent;
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
      content: {
        subject: params.mail.subject,
        plainText: params.mail.text,
        html: params.mail.html,
      },
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
