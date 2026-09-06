import type { CompanyDto } from '@peoplepay360/shared';

/**
 * The mail this system sends, as HTML.
 *
 * Written the way mail clients still need rather than the way the app is
 * written: nested tables for layout, every rule inline, fixed pixel widths, no
 * external images. Outlook renders with Word, Gmail strips most of a <style>
 * block, and roughly half of everyone has images off by default — so a design
 * that leans on flexbox, a stylesheet, or a logo file is a design that arrives
 * broken for a large share of the people it is sent to.
 *
 * What is here instead: one 600px card, a coloured header band with the
 * company's initial drawn as text rather than fetched as an image, and a
 * plain-text alternative built from the same values, so a client that refuses
 * the HTML still gets a readable message rather than a wall of markup.
 */

/** The app's own tokens, converted out of oklch once so mail matches screen. */
const BRAND = {
  primary: '#8234eb',
  primaryDark: '#6a1dc6',
  /** The faintest purple, for panels that should read as "ours" but recede. */
  tint: '#f6f3ff',
  ink: '#0a0a0a',
  muted: '#737373',
  border: '#e5e5e5',
  page: '#f5f5f5',
  card: '#ffffff',
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

export interface EmailContent {
  subject: string;
  html: string;
  /** Sent alongside the HTML, and the version written to the outbox. */
  text: string;
}

/**
 * Everything interpolated goes through this. A surname with an ampersand in it
 * would otherwise end the attribute it landed in and take the rest of the
 * layout with it.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Matches the app and the payslip PDF, which both say "Rs." rather than ₹. */
function money(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${BRAND.ink};">${text}</p>`;
}

/** Smaller and grey: the things worth saying but not worth reading first. */
function note(text: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;line-height:20px;color:${BRAND.muted};">${text}</p>`;
}

type Row = { label: string; value: string; emphasis?: boolean; mono?: boolean };

/**
 * A label/value panel — the period and net pay on a payslip, the address and
 * password on an invite.
 *
 * A table rather than a definition list because Outlook collapses the margins
 * of anything else, and rows are separated by a border on the cell rather than
 * a <hr>, which Word draws at its own width.
 */
function panel(rows: Row[]): string {
  const cells = rows
    .map((row, index) => {
      const divider =
        index === 0 ? '' : `border-top:1px solid ${BRAND.border};`;
      const valueStyle = [
        `font-family:${row.mono ? MONO : FONT}`,
        `font-size:${row.emphasis ? '20px' : '15px'}`,
        `line-height:${row.emphasis ? '26px' : '22px'}`,
        `font-weight:${row.emphasis ? '700' : '600'}`,
        `color:${row.emphasis ? BRAND.primary : BRAND.ink}`,
        row.mono ? 'letter-spacing:0.5px' : '',
      ]
        .filter(Boolean)
        .join(';');

      return `<tr>
            <td style="padding:${index === 0 ? '0' : '14px'} 0 0;${divider}">
              <div style="padding-top:${index === 0 ? '0' : '14px'};">
                <div style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${BRAND.muted};">${esc(row.label)}</div>
                <div style="margin-top:4px;${valueStyle};word-break:break-word;">${esc(row.value)}</div>
              </div>
            </td>
          </tr>`;
    })
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;background:${BRAND.tint};border:1px solid ${BRAND.border};border-radius:12px;margin:0 0 24px;">
        <tr><td style="padding:20px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${cells}</table>
        </td></tr>
      </table>`;
}

/**
 * The call to action.
 *
 * Padding sits on the <td> rather than the <a> because Word ignores padding on
 * an inline element, which is how a button becomes a bare underlined word in
 * Outlook. The link fills the cell instead, so every client draws the same
 * shape.
 */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center" bgcolor="${BRAND.primary}" style="border-radius:10px;padding:14px 30px;">
            <a href="${esc(href)}" style="display:block;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;">${esc(label)}</a>
          </td>
        </tr>
      </table>`;
}

/** The address bar under the button, for anyone whose client eats the link. */
function fallbackLink(href: string): string {
  return `<p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:18px;color:${BRAND.muted};">Or paste this into your browser:</p>
      <p style="margin:0 0 24px;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all;"><a href="${esc(href)}" style="color:${BRAND.primaryDark};text-decoration:none;">${esc(href)}</a></p>`;
}

/** The company's initial, drawn rather than fetched, so images-off still has a mark. */
function monogram(companyName: string): string {
  const initial = esc((companyName.trim()[0] ?? 'P').toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="36" height="36" align="center" valign="middle" bgcolor="#ffffff" style="width:36px;height:36px;border-radius:10px;font-family:${FONT};font-size:18px;font-weight:700;line-height:36px;color:${BRAND.primary};">${initial}</td>
        </tr>
      </table>`;
}

function footer(company: CompanyDto): string {
  const address = [
    company.addressLine1,
    company.addressLine2,
    company.city,
    company.state,
    company.postalCode,
    company.country,
  ]
    .filter(Boolean)
    .join(', ');

  const contact = [company.email, company.phone, company.website]
    .filter(Boolean)
    .join(' &middot; ');

  const lines = [
    `<strong style="color:${BRAND.ink};font-weight:600;">${esc(company.legalName ?? company.name)}</strong>`,
    address ? esc(address) : '',
    contact,
    'Sent automatically by PeoplePay360. Please do not reply to this message.',
  ].filter(Boolean);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td align="center" style="padding:24px 8px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${BRAND.muted};">
          ${lines.join('<br />')}
        </td></tr>
      </table>`;
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                       */
/* -------------------------------------------------------------------------- */

function layout(params: {
  subject: string;
  /** The grey line the inbox shows beside the subject, before anything opens. */
  preheader: string;
  company: CompanyDto;
  heading: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<!-- Declared light-only: a client that inverts an email for dark mode turns a
     white card grey and leaves the black text on it exactly where it was. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(params.subject)}</title>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${BRAND.page};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(params.preheader)}</div>
  <!-- Padded out so the preview line is the preheader and not the first
       heading repeated back. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.page};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!-- width:100% with a max, not a fixed 600: a hard 600px table is
             wider than a phone and the whole message scrolls sideways. Outlook
             is the client that ignores max-width, so it gets a 600px ghost
             table around this one and nothing else sees it. -->
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" align="center"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;">

          <tr>
            <td bgcolor="${BRAND.primary}" style="background-color:${BRAND.primary};border-radius:16px 16px 0 0;padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">${monogram(params.company.name)}</td>
                  <td valign="middle" style="padding-left:12px;font-family:${FONT};font-size:16px;font-weight:600;line-height:22px;letter-spacing:0.2px;color:#ffffff;">${esc(params.company.name)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 16px 16px;padding:32px 28px 28px;">
              <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.2px;color:${BRAND.ink};">${esc(params.heading)}</h1>
              ${params.body}
            </td>
          </tr>

          <tr><td>${footer(params.company)}</td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Joins the plain-text alternative, collapsing the runs of blank lines. */
function plain(lines: (string | null)[]): string {
  return lines
    .filter((line) => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function plainFooter(company: CompanyDto): (string | null)[] {
  const address = [
    company.addressLine1,
    company.addressLine2,
    company.city,
    company.state,
    company.postalCode,
    company.country,
  ]
    .filter(Boolean)
    .join(', ');

  const contact = [company.email, company.phone, company.website]
    .filter(Boolean)
    .join(' · ');

  return [
    '',
    '--',
    company.legalName ?? company.name,
    address || null,
    contact || null,
    'Sent automatically by PeoplePay360. Please do not reply to this message.',
  ];
}

/* -------------------------------------------------------------------------- */
/* The messages                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The invite that goes out when an account is created.
 *
 * The one-time password is the whole point of the message, so it gets a panel
 * of its own in a monospace face — an O and a 0 in body text is a support
 * ticket. The security line is last because it is the one someone re-reads
 * after the fact, not the one they act on.
 */
export function inviteEmail(params: {
  name: string;
  email: string;
  password: string;
  signInUrl: string;
  company: CompanyDto;
}): EmailContent {
  const subject = `Your ${params.company.name} account`;
  const firstName = params.name.trim().split(/\s+/)[0] || params.name;

  const body = [
    // No "Hello Dhruv" here: the heading above already says Welcome, Dhruv,
    // and greeting someone twice in four words reads like a mail merge. The
    // plain-text version keeps it — there is no heading there to carry it.
    paragraph(
      `An account has been created for you on <strong style="font-weight:600;">${esc(params.company.name)}</strong>. It is where you check in and out, request leave, sign documents and read your payslips.`
    ),
    panel([
      { label: 'Sign in with', value: params.email },
      { label: 'One-time password', value: params.password, mono: true },
    ]),
    button(params.signInUrl, 'Sign in and set your password'),
    fallbackLink(params.signInUrl),
    note(
      'That password works once. You will be asked to choose your own as soon as you sign in.'
    ),
    note(
      'If you were not expecting this, tell your HR team rather than signing in.'
    ),
  ].join('\n      ');

  const text = plain([
    `Hello ${firstName},`,
    '',
    `An account has been created for you on ${params.company.name}, where you can`,
    'check in and out, request leave, sign documents and read your payslips.',
    '',
    `Sign in at: ${params.signInUrl}`,
    `Email:      ${params.email}`,
    `Password:   ${params.password}`,
    '',
    'That password works once. You will be asked to choose your own as soon',
    'as you sign in.',
    '',
    'If you were not expecting this, tell your HR team rather than signing in.',
    ...plainFooter(params.company),
  ]);

  return {
    subject,
    html: layout({
      subject,
      preheader: `Your sign-in details for ${params.company.name} are inside.`,
      company: params.company,
      heading: `Welcome, ${firstName}`,
      body,
    }),
    text,
  };
}

/**
 * The covering note for a payslip.
 *
 * The PDF is the document; this is the receipt for it. Net pay is repeated in
 * the body on purpose — it is the one figure most people want, and reading it
 * should not require opening an attachment on a phone.
 */
export function payslipEmail(params: {
  employeeName: string;
  payslipNumber: string;
  periodStart: Date;
  periodEnd: Date;
  netPay: number;
  company: CompanyDto;
  /** Where to read it in the app. Omitted when no public URL is configured. */
  payUrl?: string;
}): EmailContent {
  const period = `${formatDate(params.periodStart)} to ${formatDate(params.periodEnd)}`;
  const subject = `Payslip ${params.payslipNumber} - ${period}`;
  // "September 2026" rather than the full range wherever the run sits inside
  // one month, which is nearly always. The exact dates are in the panel below
  // it; a heading that reads the same as the row under it says nothing twice.
  const headingPeriod =
    params.periodStart.getMonth() === params.periodEnd.getMonth() &&
    params.periodStart.getFullYear() === params.periodEnd.getFullYear()
      ? params.periodStart.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
      : period;
  const firstName =
    params.employeeName.trim().split(/\s+/)[0] || params.employeeName;

  const body = [
    paragraph(`Hello ${esc(firstName)},`),
    paragraph(
      'Your payslip for the period below is attached to this email as a PDF.'
    ),
    panel([
      { label: 'Pay period', value: period },
      { label: 'Payslip number', value: params.payslipNumber },
      { label: 'Net pay', value: money(params.netPay), emphasis: true },
    ]),
    params.payUrl ? button(params.payUrl, 'View your payslips') : '',
    note(
      'If any detail looks incorrect, contact the payroll team before the next pay run.'
    ),
  ]
    .filter(Boolean)
    .join('\n      ');

  const text = plain([
    `Hello ${firstName},`,
    '',
    `Please find attached your payslip for the period ${period}.`,
    '',
    `Payslip number: ${params.payslipNumber}`,
    `Net pay:        ${money(params.netPay)}`,
    params.payUrl ? '' : null,
    params.payUrl ? `Read it in the app: ${params.payUrl}` : null,
    '',
    'If any detail looks incorrect, contact the payroll team before the next',
    'pay run.',
    ...plainFooter(params.company),
  ]);

  return {
    subject,
    html: layout({
      subject,
      preheader: `${money(params.netPay)} for ${period}. The PDF is attached.`,
      company: params.company,
      heading: `Your payslip for ${headingPeriod}`,
      body,
    }),
    text,
  };
}
