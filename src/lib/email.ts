import { prisma } from './prisma';
import { formatDate, formatMoney } from './utils';
import { generatePayslipPDF } from './pdf';

/**
 * Payslip delivery. With no SMTP host configured the message is recorded in the
 * in-app Email Outbox instead of dialling out, so the bulk-send flow is fully
 * demonstrable without credentials. Setting SMTP_HOST switches to real sending.
 */
export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}

export interface SendResult {
  sent: number;
  failed: number;
  logs: { toEmail: string; status: string; error?: string }[];
}

function payslipEmailBody(params: {
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
    `Net Pay: ${formatMoney(params.netPay)}`,
    '',
    'If any detail looks incorrect, please contact the payroll team.',
    '',
    'Regards,',
    'Payroll Team — PeoplePay360',
  ].join('\n');
}

/** Send (or log) payslips for every payslip in a payrun. */
export async function sendPayrunPayslips(payrunId: string): Promise<SendResult> {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: { payslips: { include: { employee: true } } },
  });

  if (!payrun) throw new Error('Payrun not found.');

  const result: SendResult = { sent: 0, failed: 0, logs: [] };

  for (const payslip of payrun.payslips) {
    const employee = payslip.employee;
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const subject = `Payslip ${payslip.number} — ${formatDate(payslip.periodStart)} to ${formatDate(payslip.periodEnd)}`;
    const body = payslipEmailBody({
      employeeName,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,
      netPay: payslip.netPay,
      payslipNumber: payslip.number,
    });

    try {
      if (!employee.workEmail) throw new Error('Employee has no work email address.');

      // Generating the PDF proves the attachment is producible before we claim
      // the message was delivered.
      const { filename } = await generatePayslipPDF(payslip.id);

      if (isSmtpConfigured()) {
        await sendViaSmtp({ to: employee.workEmail, subject, body });
      }

      await prisma.emailLog.create({
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
      result.logs.push({ toEmail: employee.workEmail, status: 'SENT' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      await prisma.emailLog.create({
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
      result.logs.push({
        toEmail: employee.workEmail ?? 'unknown',
        status: 'FAILED',
        error: message,
      });
    }
  }

  return result;
}

/**
 * Real SMTP delivery. Nodemailer is loaded lazily so the app runs without the
 * optional dependency when SMTP is not in use.
 */
async function sendViaSmtp(params: { to: string; subject: string; body: string }): Promise<void> {
  // Resolved at runtime so the package stays optional; the app runs without it
  // whenever SMTP is not configured.
  const nodemailer = await import(/* webpackIgnore: true */ 'nodemailer' as string).catch(
    () => null
  );
  if (!nodemailer) {
    throw new Error('SMTP_HOST is set but nodemailer is not installed. Run: npm i nodemailer');
  }

  const transport = (nodemailer.default ?? nodemailer).createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });

  await transport.sendMail({
    from: process.env.MAIL_FROM ?? 'payroll@peoplepay360.com',
    to: params.to,
    subject: params.subject,
    text: params.body,
  });
}
