import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { generatePayslipPDF } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payslip = await prisma.payslip.findUnique({
    where: { id },
    select: { employeeId: true },
  });
  if (!payslip) {
    return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
  }

  // Payroll roles may print anyone's payslip; an employee only their own.
  const allowed = can(session.role, 'payslips', 'read') || session.employeeId === payslip.employeeId;
  if (!allowed) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { buffer, filename } = await generatePayslipPDF(id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
