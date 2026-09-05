import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 p-12 text-white lg:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
              P
            </div>
            <span className="text-lg font-bold tracking-tight">PeoplePay360</span>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold leading-tight">
            HR and payroll, connected end to end.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            From employee master data and period-scoped contracts through attendance,
            leave balances and sequenced salary rules — all the way to validated
            payslips, PDFs and delivery.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {[
              'Period-accurate contract resolution',
              'Allocation-backed leave balances',
              'Sequenced, formula-driven salary rules',
              'Live payroll dashboard',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">Integrated Human Resource &amp; Payroll Operations</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
                P
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">PeoplePay360</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Access your HR and payroll workspace.</p>

          <LoginForm />

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Demo accounts · password123
            </p>
            <div className="space-y-1.5 text-xs">
              {[
                ['admin@peoplepay360.com', 'Admin'],
                ['payroll@peoplepay360.com', 'HR Payroll Manager'],
                ['hr@peoplepay360.com', 'HR Manager'],
                ['employee@peoplepay360.com', 'Employee'],
              ].map(([email, role]) => (
                <div key={email} className="flex items-center justify-between gap-2">
                  <code className="text-slate-700">{email}</code>
                  <span className="shrink-0 text-slate-400">{role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
