'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { toDateInput } from '@/lib/utils';
import type { ActionState } from '@/app/(app)/employees/actions';

interface Option {
  id: string;
  name: string;
}

/** Dates arrive from the API as ISO strings, not Date objects. */
export interface EmployeeFormValues {
  id?: string;
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  workPhone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  employeeType?: string;
  status?: string;
  hireDate?: string | null;
  exitDate?: string | null;
  departmentId?: string | null;
  jobPositionId?: string | null;
  managerId?: string | null;
  workingScheduleId?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function EmployeeForm({
  action,
  employee,
  departments,
  positions,
  managers,
  schedules,
  submitLabel,
  cancelHref,
  readOnly = false,
}: {
  action: (prev: ActionState | null, form: FormData) => Promise<ActionState>;
  employee?: EmployeeFormValues;
  departments: Option[];
  positions: Option[];
  managers: { id: string; fullName: string }[];
  schedules: Option[];
  submitLabel: string;
  cancelHref: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-5">
      {employee?.id && <input type="hidden" name="id" value={employee.id} />}

      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <Section title="Identity">
        <Text name="firstName" label="First Name" defaultValue={employee?.firstName} required disabled={readOnly} />
        <Text name="lastName" label="Last Name" defaultValue={employee?.lastName} required disabled={readOnly} />
        <Text name="workEmail" label="Work Email" type="email" defaultValue={employee?.workEmail} required disabled={readOnly} />
        <Text name="workPhone" label="Work Phone" defaultValue={employee?.workPhone ?? ''} disabled={readOnly} />
        <Text name="dateOfBirth" label="Date of Birth" type="date" defaultValue={toDateInput(employee?.dateOfBirth)} disabled={readOnly} />
        <Select name="gender" label="Gender" defaultValue={employee?.gender ?? ''} disabled={readOnly}
          options={[{ value: '', label: '—' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} />
        <Text name="address" label="Address" defaultValue={employee?.address ?? ''} className="sm:col-span-2 lg:col-span-3" disabled={readOnly} />
      </Section>

      <Section title="Work Information">
        <Select name="departmentId" label="Department" defaultValue={employee?.departmentId ?? ''} disabled={readOnly}
          options={[{ value: '', label: '—' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
        <Select name="jobPositionId" label="Job Position" defaultValue={employee?.jobPositionId ?? ''} disabled={readOnly}
          options={[{ value: '', label: '—' }, ...positions.map((p) => ({ value: p.id, label: p.name }))]} />
        <Select name="managerId" label="Manager" defaultValue={employee?.managerId ?? ''} disabled={readOnly}
          options={[
            { value: '', label: '—' },
            ...managers
              .filter((m) => m.id !== employee?.id)
              .map((m) => ({ value: m.id, label: m.fullName })),
          ]} />
        <Select name="workingScheduleId" label="Working Schedule" defaultValue={employee?.workingScheduleId ?? ''} disabled={readOnly}
          options={[{ value: '', label: '—' }, ...schedules.map((s) => ({ value: s.id, label: s.name }))]} />
        <Select name="employeeType" label="Employee Type" defaultValue={employee?.employeeType ?? 'FULL_TIME'} disabled={readOnly}
          options={[
            { value: 'FULL_TIME', label: 'Full time' },
            { value: 'PART_TIME', label: 'Part time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]} />
        <Select name="status" label="Status" defaultValue={employee?.status ?? 'ACTIVE'} disabled={readOnly}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'ON_LEAVE', label: 'On leave' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]} />
        <Text name="hireDate" label="Hire Date" type="date" defaultValue={toDateInput(employee?.hireDate)} required disabled={readOnly} />
        {employee?.id && (
          <Text name="exitDate" label="Exit Date" type="date" defaultValue={toDateInput(employee?.exitDate)} disabled={readOnly} />
        )}
      </Section>

      <Section
        title="Bank Details"
        hint="Payroll cannot release payment without these, and the payrun will warn before validation."
      >
        <Text name="bankName" label="Bank Name" defaultValue={employee?.bankName ?? ''} disabled={readOnly} />
        <Text name="bankAccountNumber" label="Account Number" defaultValue={employee?.bankAccountNumber ?? ''} disabled={readOnly} />
      </Section>

      {!readOnly && (
        <div className="flex items-center gap-2 border-t border-slate-200 pt-5">
          <SubmitButton label={submitLabel} />
          <Link href={cancelHref} className="btn-secondary">
            Cancel
          </Link>
        </div>
      )}
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Text({
  name,
  label,
  type = 'text',
  defaultValue,
  required,
  className,
  disabled,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        className="input"
      />
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  options,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} disabled={disabled} className="input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
