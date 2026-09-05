'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Badge, StatusBadge } from '@/components/ui';
import { ROLE_LABELS, ROLES, type Role } from '@/lib/rbac';
import { saveUserAction, deleteUserAction } from '../actions';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  employeeId: string | null;
  employeeName: string | null;
}

const ROLE_TONES: Record<string, 'slate' | 'blue' | 'violet' | 'emerald' | 'red'> = {
  EMPLOYEE: 'slate',
  HR_MANAGER: 'blue',
  HR_PAYROLL_USER: 'violet',
  HR_PAYROLL_MANAGER: 'emerald',
  ADMIN: 'red',
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary btn-sm" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}

export function UsersManager({
  users,
  employees,
  currentUserId,
  canManage,
  canDelete,
}: {
  users: UserRow[];
  employees: { id: string; name: string; linked: boolean }[];
  currentUserId: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      {canManage && !creating && !editing && (
        <div className="mb-4">
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            New User
          </button>
        </div>
      )}

      {(creating || editing) && (
        <UserForm
          user={editing ?? undefined}
          employees={employees}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Linked Employee</th>
              <th>Status</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <span className="block font-medium text-slate-900">{u.name}</span>
                  <span className="block text-xs text-slate-500">{u.email}</span>
                </td>
                <td>
                  <Badge tone={ROLE_TONES[u.role] ?? 'slate'}>
                    {ROLE_LABELS[u.role as Role] ?? u.role}
                  </Badge>
                </td>
                <td className="text-sm">
                  {u.employeeName ?? <span className="text-slate-400">Not linked</span>}
                </td>
                <td>
                  <StatusBadge status={u.active ? 'ACTIVE' : 'INACTIVE'} />
                </td>
                {canManage && (
                  <td>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(u);
                          setCreating(false);
                        }}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      {canDelete && u.id !== currentUserId && <DeleteUserButton id={u.id} />}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserForm({
  user,
  employees,
  onDone,
}: {
  user?: UserRow;
  employees: { id: string; name: string; linked: boolean }[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveUserAction, null);

  if (state?.success) setTimeout(onDone, 0);

  return (
    <form action={formAction} className="card mb-4 p-5">
      {user && <input type="hidden" name="id" value={user.id} />}

      <h3 className="mb-4 text-sm font-semibold text-slate-900">
        {user ? `Edit ${user.name}` : 'New User'}
      </h3>

      {state?.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input id="name" name="name" defaultValue={user?.name} required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={user?.email}
            required
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="role">
            Role <span className="text-red-500">*</span>
          </label>
          <select id="role" name="role" defaultValue={user?.role ?? 'EMPLOYEE'} required className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password {!user && <span className="text-red-500">*</span>}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required={!user}
            placeholder={user ? 'Leave blank to keep current' : 'At least 8 characters'}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="employeeId">
            Linked Employee
          </label>
          <select
            id="employeeId"
            name="employeeId"
            defaultValue={user?.employeeId ?? ''}
            className="input"
          >
            <option value="">Not linked</option>
            {employees
              .filter((e) => !e.linked || e.id === user?.employeeId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user?.active ?? true}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Active
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4">
        <SubmitButton label={user ? 'Save User' : 'Create User'} />
        <button type="button" onClick={onDone} className="btn-secondary btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteUserButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (error) return <span className="text-[11px] text-red-600">{error}</span>;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="font-medium text-red-600 hover:underline"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await deleteUserAction(id);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed.');
            }
          })
        }
        className="font-medium text-red-600 hover:underline"
      >
        {pending ? '…' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-slate-500 hover:underline"
      >
        No
      </button>
    </span>
  );
}
