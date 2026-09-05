import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

/**
 * Proxies the payslip PDF from the API.
 *
 * The browser opens this link directly and cannot set an Authorization header,
 * so this route reads the httpOnly session cookie and forwards it as a bearer
 * token. That keeps the token out of the URL and out of client-side JavaScript.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const apiBase =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const upstream = await fetch(`${apiBase}/api/payslips/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'Unable to generate payslip PDF' },
      { status: upstream.status }
    );
  }

  const buffer = await upstream.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        upstream.headers.get('content-disposition') ?? `inline; filename="payslip-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
