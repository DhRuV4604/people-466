import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { Role, Module, Action } from './rbac';
import { assertCan, can } from './rbac';

const COOKIE_NAME = 'pp360_session';
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'peoplepay360-dev-secret-change-in-production-0123456789'
);

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
      employeeId: (payload.employeeId as string) ?? null,
    };
  } catch {
    return null;
  }
}

/** Throws when unauthenticated; use in server actions and route handlers. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

/** Throws unless the signed-in user may perform the action on the module. */
export async function requirePermission(module: Module, action: Action): Promise<Session> {
  const session = await requireSession();
  assertCan(session.role, module, action);
  return session;
}

export async function currentUserCan(module: Module, action: Action): Promise<boolean> {
  const session = await getSession();
  return session ? can(session.role, module, action) : false;
}

export async function authenticate(email: string, password: string): Promise<Session | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { employee: { select: { id: true } } },
  });
  if (!user || !user.active) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    employeeId: user.employee?.id ?? null,
  };
}
