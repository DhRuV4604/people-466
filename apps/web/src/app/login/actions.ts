'use server';

import { redirect } from 'next/navigation';
import { login, logout } from '@/lib/session';
import { ApiError } from '@/lib/api-client';

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Email and password are required.' };

  let role: string;
  try {
    const result = await login(email, password);
    role = result.user.role;
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.status === 401 ? 'Invalid email or password.' : err.message };
    }
    return { error: 'Unable to reach the API. Is the backend running?' };
  }

  // Employees have no admin modules, so send them to self-service.
  redirect(role === 'EMPLOYEE' ? '/my-space' : '/dashboard');
}

export async function logoutAction() {
  await logout();
  redirect('/login');
}
