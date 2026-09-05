import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? (session.role === 'EMPLOYEE' ? '/my-space' : '/dashboard') : '/login');
}
