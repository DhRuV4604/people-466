import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { EmailLogDto } from '@peoplepay360/shared';
import { getSession } from '@/lib/session';
import { apiGetOrRedirect, payslipPdfUrl } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import { PageHeader, EmptyState, StatusBadge, KpiCard, AlertBanner } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function OutboxPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const emails = await apiGetOrRedirect<EmailLogDto[]>('/email-logs', '/my-space');

  const sent = emails.filter((e) => e.status === 'SENT').length;
  const failed = emails.filter((e) => e.status === 'FAILED').length;

  return (
    <>
      <PageHeader
        title="Email Outbox"
        subtitle="Every payslip delivery attempted from a pay run, with its generated PDF attachment."
      />

      <div className="mb-5">
        <AlertBanner
          tone="info"
          title="Delivery mode"
          items={[
            'When no SMTP host is configured on the API, messages are recorded here instead of being dispatched. Each entry has a real generated PDF attachment. Set SMTP_HOST in the API environment to switch to live sending.',
          ]}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Total Messages" value={emails.length} />
        <KpiCard label="Delivered" value={sent} tone="positive" />
        <KpiCard label="Failed" value={failed} tone={failed > 0 ? 'danger' : 'default'} />
      </div>

      {emails.length === 0 ? (
        <EmptyState
          title="Outbox is empty"
          description="Use Send Payslips on a computed pay run to distribute payslips."
          action={
            <Link href="/payroll/payruns" className="btn-primary">
              Go to Pay Runs
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Attachment</th>
                <th>Pay Run</th>
                <th>Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="block font-medium text-slate-900">{e.toName ?? '—'}</span>
                    <span className="block text-xs text-slate-500">{e.toEmail}</span>
                  </td>
                  <td className="max-w-xs">
                    <span className="block truncate text-sm text-slate-700">{e.subject}</span>
                  </td>
                  <td>
                    {e.attachmentName ? (
                      e.payslipId ? (
                        <Link
                          href={payslipPdfUrl(e.payslipId)}
                          target="_blank"
                          className="text-xs text-brand-600 hover:underline"
                        >
                          {e.attachmentName}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">{e.attachmentName}</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-xs">
                    {e.payrun ? (
                      <Link
                        href={`/payroll/payruns/${e.payrunId}`}
                        className="text-brand-600 hover:underline"
                      >
                        {e.payrun.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-xs">{formatDateTime(e.sentAt)}</td>
                  <td>
                    <StatusBadge status={e.status === 'SENT' ? 'APPROVED' : 'REFUSED'} />
                    {e.error && <p className="mt-0.5 text-[11px] text-red-600">{e.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
