/**
 * Seed a representative dataset: enough history for the dashboard trends to be
 * meaningful, and deliberate imperfections (expired contracts, missing bank
 * details, late punches, missing check-outs) so the warning and exception paths
 * are demonstrable rather than theoretical.
 */
import {
  PrismaClient,
  type ComputeType,
  type ContractType,
  type EmployeeType,
  type RuleCategory,
  type ScheduleType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

// Deterministic PRNG so reseeding produces the same demo data every time.
let seedState = 20260101;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

async function main() {
  // The container entrypoint passes --if-empty so a restart against an existing
  // volume keeps its data; run bare (npm run db:seed) to force a reseed.
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.log('Database already contains data; skipping seed.');
    return;
  }

  console.log('Clearing existing data...');
  await prisma.emailLog.deleteMany();
  await prisma.payslipLine.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrun.deleteMany();
  await prisma.salaryRule.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveAllocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.workingScheduleLine.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.jobPosition.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  // Policy is a singleton rather than a collection, so a re-seed puts it back
  // to the documented defaults instead of carrying an edited cap forward.
  await prisma.appSettings.deleteMany();

  // ---------------------------------------------------------------- Schedules
  console.log('Creating working schedules...');

  const scheduleDefs: {
    name: string;
    scheduleType: ScheduleType;
    lines: { dayOfWeek: number; startTime: string; endTime: string; breakHours: number }[];
  }[] = [
    {
      name: 'Standard 40 Hours/Week',
      scheduleType: 'FULL_TIME',
      lines: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        startTime: '09:00',
        endTime: '18:00',
        breakHours: 1,
      })),
    },
    {
      name: 'Part Time 20 Hours/Week',
      scheduleType: 'PART_TIME',
      lines: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        startTime: '09:00',
        endTime: '13:00',
        breakHours: 0,
      })),
    },
    {
      name: 'Four Day Week 32 Hours',
      scheduleType: 'FLEXIBLE',
      lines: [1, 2, 3, 4].map((d) => ({
        dayOfWeek: d,
        startTime: '09:00',
        endTime: '18:00',
        breakHours: 1,
      })),
    },
    {
      name: 'Night Shift 40 Hours/Week',
      scheduleType: 'FULL_TIME',
      lines: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        startTime: '22:00',
        endTime: '06:00',
        breakHours: 0,
      })),
    },
  ];

  const schedules = [];
  for (const def of scheduleDefs) {
    const weekly = round2(
      def.lines.reduce((sum, l) => {
        const start = parseTime(l.startTime);
        const end = parseTime(l.endTime);
        const span = end > start ? end - start : 24 - start + end;
        return sum + Math.max(0, span - l.breakHours);
      }, 0)
    );

    const schedule = await prisma.workingSchedule.create({
      data: {
        name: def.name,
        scheduleType: def.scheduleType,
        hoursPerWeek: weekly,
        lines: { create: def.lines },
      },
      include: { lines: true },
    });
    schedules.push(schedule);
  }

  const [standardSchedule, partTimeSchedule, fourDaySchedule, nightSchedule] = schedules;

  // ---------------------------------------------------------------- Org structure
  console.log('Creating departments and positions...');

  const departmentNames = ['Engineering', 'Sales', 'Human Resources', 'Finance', 'Operations'];
  const departments = [];
  for (const name of departmentNames) {
    departments.push(
      await prisma.department.create({
        data: { name, code: name.slice(0, 3).toUpperCase() },
      })
    );
  }
  const [engineering, sales, hr, finance, operations] = departments;

  const positionsByDept: Record<string, string[]> = {
    Engineering: ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager', 'QA Engineer'],
    Sales: ['Sales Executive', 'Account Manager', 'Sales Director'],
    'Human Resources': ['HR Executive', 'HR Manager', 'Recruiter'],
    Finance: ['Accountant', 'Payroll Officer', 'Finance Manager'],
    Operations: ['Operations Executive', 'Operations Manager', 'Support Specialist'],
  };

  const positions: Record<string, { id: string; name: string }> = {};
  for (const list of Object.values(positionsByDept)) {
    for (const name of list) {
      if (!positions[name]) {
        positions[name] = await prisma.jobPosition.create({ data: { name } });
      }
    }
  }

  // ---------------------------------------------------------------- Salary config
  console.log('Creating salary structures and rules...');

  const regularStructure = await prisma.salaryStructure.create({
    data: {
      name: 'Regular Salary',
      code: 'REG',
      description:
        'Standard monthly structure: basic, house rent and transport allowances, statutory PF and professional tax, plus income tax.',
    },
  });

  // Sequence matters: each rule may reference codes computed before it.
  type SeedPayslipLine = {
    code: string;
    name: string;
    category: RuleCategory;
    sequence: number;
    amount: number;
    quantity: number;
    rate: number;
  };
  const line = (l: SeedPayslipLine) => l;

  const ruleDefs = <T extends { category: RuleCategory; computeType: ComputeType }[]>(r: T) => r;

  const regularRules = ruleDefs([
    {
      name: 'Basic Salary',
      code: 'BASIC',
      category: 'BASIC',
      sequence: 10,
      computeType: 'FORMULA',
      // Pro-rate the contract wage by attendance, but never pay below the paid-leave floor.
      formula:
        'scheduledDays > 0 ? wage * Math.min(1, (workedDays + paidLeaveDays) / scheduledDays) : wage',
      note: 'Contract wage pro-rated by worked plus paid-leave days.',
    },
    {
      name: 'House Rent Allowance',
      code: 'HRA',
      category: 'ALLOWANCE',
      sequence: 20,
      computeType: 'PERCENTAGE',
      amountPercentage: 40,
      percentageBase: 'BASIC',
      note: '40% of basic.',
    },
    {
      name: 'Transport Allowance',
      code: 'TA',
      category: 'ALLOWANCE',
      sequence: 30,
      computeType: 'FIXED',
      amountFixed: 2400,
      note: 'Flat monthly transport allowance.',
    },
    {
      name: 'Medical Allowance',
      code: 'MA',
      category: 'ALLOWANCE',
      sequence: 40,
      computeType: 'FIXED',
      amountFixed: 1800,
      note: 'Flat monthly medical allowance.',
    },
    {
      name: 'Overtime Pay',
      code: 'OT',
      category: 'ALLOWANCE',
      sequence: 50,
      computeType: 'FORMULA',
      formula: 'overtimeHours * (BASIC / 160) * 1.5',
      condition: 'overtimeHours > 0',
      note: 'Overtime at 1.5x the derived hourly rate.',
    },
    {
      name: 'Gross Salary',
      code: 'GROSS',
      category: 'GROSS',
      sequence: 100,
      computeType: 'FORMULA',
      formula: 'BASIC + HRA + TA + MA + OT',
      note: 'Sum of basic and all allowances.',
    },
    {
      name: 'Provident Fund',
      code: 'PF',
      category: 'DEDUCTION',
      sequence: 110,
      computeType: 'FORMULA',
      // Statutory PF is capped at 12% of a 15,000 wage ceiling.
      formula: 'Math.min(BASIC, 15000) * 0.12',
      note: '12% of basic, capped at the statutory ceiling.',
    },
    {
      name: 'Professional Tax',
      code: 'PT',
      category: 'DEDUCTION',
      sequence: 120,
      computeType: 'FIXED',
      amountFixed: 200,
      condition: 'GROSS > 15000',
      note: 'Flat monthly professional tax above a gross threshold.',
    },
    {
      name: 'Income Tax (TDS)',
      code: 'TDS',
      category: 'DEDUCTION',
      sequence: 130,
      computeType: 'FORMULA',
      // Simplified slab on annualised gross.
      formula:
        'GROSS * 12 > 1000000 ? GROSS * 0.15 : (GROSS * 12 > 500000 ? GROSS * 0.08 : 0)',
      note: 'Simplified slab-based TDS on annualised gross.',
    },
    {
      name: 'Unpaid Leave Deduction',
      code: 'ULD',
      category: 'DEDUCTION',
      sequence: 140,
      computeType: 'FORMULA',
      formula: 'scheduledDays > 0 ? (wage / scheduledDays) * unpaidLeaveDays : 0',
      condition: 'unpaidLeaveDays > 0',
      note: 'Per-day deduction for unpaid leave taken in the period.',
    },
    {
      name: 'Net Salary',
      code: 'NET',
      category: 'NET',
      sequence: 200,
      computeType: 'FORMULA',
      formula: 'GROSS - PF - PT - TDS - ULD',
      note: 'Gross less all deductions.',
    },
  ]);

  for (const rule of regularRules) {
    await prisma.salaryRule.create({
      data: { ...rule, structureId: regularStructure.id },
    });
  }

  // A second, simpler structure proves the payrun's structure choice actually
  // changes which rules run.
  const internStructure = await prisma.salaryStructure.create({
    data: {
      name: 'Intern Stipend',
      code: 'INT',
      description: 'Flat stipend structure for interns with no statutory deductions.',
    },
  });

  const internRules = ruleDefs([
    {
      name: 'Stipend',
      code: 'BASIC',
      category: 'BASIC',
      sequence: 10,
      computeType: 'FORMULA',
      formula:
        'scheduledDays > 0 ? wage * Math.min(1, (workedDays + paidLeaveDays) / scheduledDays) : wage',
    },
    {
      name: 'Gross Stipend',
      code: 'GROSS',
      category: 'GROSS',
      sequence: 100,
      computeType: 'FORMULA',
      formula: 'BASIC',
    },
    {
      name: 'Professional Tax',
      code: 'PT',
      category: 'DEDUCTION',
      sequence: 110,
      computeType: 'FIXED',
      amountFixed: 200,
      condition: 'GROSS > 20000',
    },
    {
      name: 'Net Stipend',
      code: 'NET',
      category: 'NET',
      sequence: 200,
      computeType: 'FORMULA',
      formula: 'GROSS - PT',
    },
  ]);

  for (const rule of internRules) {
    await prisma.salaryRule.create({
      data: { ...rule, structureId: internStructure.id },
    });
  }

  // ---------------------------------------------------------------- Time off types
  console.log('Creating time off types...');

  const annualLeave = await prisma.timeOffType.create({
    data: {
      name: 'Annual Leave',
      code: 'ANNUAL',
      unit: 'DAY',
      requiresAllocation: true,
      requiresApproval: true,
      paid: true,
      colorHex: '#2563eb',
      maxDaysPerRequest: 15,
    },
  });

  const sickLeave = await prisma.timeOffType.create({
    data: {
      name: 'Sick Leave',
      code: 'SICK',
      unit: 'DAY',
      requiresAllocation: true,
      requiresApproval: true,
      paid: true,
      colorHex: '#dc2626',
      maxDaysPerRequest: 7,
    },
  });

  const unpaidLeave = await prisma.timeOffType.create({
    data: {
      name: 'Unpaid Leave',
      code: 'UNPAID',
      unit: 'DAY',
      // No allocation needed - it is simply not paid.
      requiresAllocation: false,
      requiresApproval: true,
      paid: false,
      colorHex: '#6b7280',
    },
  });

  const compOff = await prisma.timeOffType.create({
    data: {
      name: 'Compensatory Off',
      code: 'COMPOFF',
      unit: 'DAY',
      requiresAllocation: true,
      requiresApproval: true,
      paid: true,
      colorHex: '#059669',
      maxDaysPerRequest: 3,
    },
  });

  const timeOffTypes = [annualLeave, sickLeave, unpaidLeave, compOff];

  // ---------------------------------------------------------------- Employees
  console.log('Creating employees, users and contracts...');

  const password = await bcrypt.hash('password123', 10);

  interface Person {
    first: string;
    last: string;
    dept: { id: string; name: string };
    position: string;
    type: EmployeeType;
    wage: number;
    schedule: { id: string };
    role?: string;
    isManager?: boolean;
    noBank?: boolean;
  }

  const people: Person[] = [
    // Engineering
    { first: 'Aarav', last: 'Sharma', dept: engineering, position: 'Engineering Manager', type: 'FULL_TIME', wage: 145000, schedule: standardSchedule, isManager: true },
    { first: 'Priya', last: 'Patel', dept: engineering, position: 'Senior Software Engineer', type: 'FULL_TIME', wage: 110000, schedule: standardSchedule },
    { first: 'Rohan', last: 'Mehta', dept: engineering, position: 'Software Engineer', type: 'FULL_TIME', wage: 78000, schedule: standardSchedule },
    { first: 'Ananya', last: 'Iyer', dept: engineering, position: 'Software Engineer', type: 'FULL_TIME', wage: 82000, schedule: standardSchedule },
    { first: 'Vikram', last: 'Singh', dept: engineering, position: 'QA Engineer', type: 'FULL_TIME', wage: 65000, schedule: standardSchedule },
    { first: 'Neha', last: 'Gupta', dept: engineering, position: 'Software Engineer', type: 'PART_TIME', wage: 45000, schedule: partTimeSchedule },
    { first: 'Karthik', last: 'Nair', dept: engineering, position: 'Software Engineer', type: 'INTERN', wage: 25000, schedule: fourDaySchedule },
    // Sales
    { first: 'Meera', last: 'Reddy', dept: sales, position: 'Sales Director', type: 'FULL_TIME', wage: 135000, schedule: standardSchedule, isManager: true },
    { first: 'Arjun', last: 'Kapoor', dept: sales, position: 'Account Manager', type: 'FULL_TIME', wage: 88000, schedule: standardSchedule },
    { first: 'Divya', last: 'Joshi', dept: sales, position: 'Sales Executive', type: 'FULL_TIME', wage: 62000, schedule: standardSchedule },
    { first: 'Siddharth', last: 'Rao', dept: sales, position: 'Sales Executive', type: 'CONTRACT', wage: 58000, schedule: standardSchedule, noBank: true },
    { first: 'Pooja', last: 'Desai', dept: sales, position: 'Sales Executive', type: 'FULL_TIME', wage: 60000, schedule: standardSchedule },
    // HR
    { first: 'Sanjana', last: 'Verma', dept: hr, position: 'HR Manager', type: 'FULL_TIME', wage: 105000, schedule: standardSchedule, isManager: true, role: 'HR_MANAGER' },
    { first: 'Rahul', last: 'Bhatt', dept: hr, position: 'HR Executive', type: 'FULL_TIME', wage: 58000, schedule: standardSchedule },
    { first: 'Kavya', last: 'Menon', dept: hr, position: 'Recruiter', type: 'FULL_TIME', wage: 55000, schedule: standardSchedule },
    // Finance
    { first: 'Amit', last: 'Trivedi', dept: finance, position: 'Finance Manager', type: 'FULL_TIME', wage: 125000, schedule: standardSchedule, isManager: true, role: 'HR_PAYROLL_MANAGER' },
    { first: 'Sneha', last: 'Kulkarni', dept: finance, position: 'Payroll Officer', type: 'FULL_TIME', wage: 72000, schedule: standardSchedule, role: 'HR_PAYROLL_USER' },
    { first: 'Manish', last: 'Agarwal', dept: finance, position: 'Accountant', type: 'FULL_TIME', wage: 68000, schedule: standardSchedule },
    { first: 'Ritu', last: 'Saxena', dept: finance, position: 'Accountant', type: 'PART_TIME', wage: 40000, schedule: partTimeSchedule },
    // Operations
    { first: 'Deepak', last: 'Chauhan', dept: operations, position: 'Operations Manager', type: 'FULL_TIME', wage: 98000, schedule: standardSchedule, isManager: true },
    { first: 'Shreya', last: 'Pillai', dept: operations, position: 'Operations Executive', type: 'FULL_TIME', wage: 56000, schedule: standardSchedule },
    { first: 'Nikhil', last: 'Jain', dept: operations, position: 'Support Specialist', type: 'FULL_TIME', wage: 52000, schedule: nightSchedule },
    { first: 'Tanvi', last: 'Shah', dept: operations, position: 'Support Specialist', type: 'FULL_TIME', wage: 50000, schedule: nightSchedule },
    { first: 'Harsh', last: 'Bansal', dept: operations, position: 'Operations Executive', type: 'CONTRACT', wage: 48000, schedule: standardSchedule },
    { first: 'Ishita', last: 'Ghosh', dept: operations, position: 'Support Specialist', type: 'INTERN', wage: 22000, schedule: fourDaySchedule, noBank: true },
  ];

  const today = new Date();
  const createdEmployees: { id: string; name: string; dept: string; isManager: boolean; type: string; scheduleId: string; wage: number }[] = [];
  const managerByDept: Record<string, string> = {};

  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const code = `EMP${String(i + 1).padStart(4, '0')}`;
    const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}@peoplepay360.com`;

    // Vary tenure so contract history looks realistic.
    const yearsAgo = randInt(0, 5);
    const monthsAgo = randInt(0, 11);
    const hireDate = new Date(today.getFullYear() - yearsAgo, today.getMonth() - monthsAgo, randInt(1, 28));

    const employee = await prisma.employee.create({
      data: {
        employeeCode: code,
        firstName: p.first,
        lastName: p.last,
        workEmail: email,
        workPhone: `+91 ${randInt(70, 99)}${randInt(10000000, 99999999)}`,
        dateOfBirth: new Date(today.getFullYear() - randInt(24, 48), randInt(0, 11), randInt(1, 28)),
        gender: pick(['Male', 'Female']),
        address: `${randInt(1, 200)}, ${pick(['MG Road', 'Park Street', 'Ring Road', 'Sector 21'])}, ${pick(['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad'])}`,
        // A couple of employees intentionally lack bank details to trigger payroll warnings.
        bankName: p.noBank ? null : pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank']),
        bankAccountNumber: p.noBank ? null : String(randInt(100000000000, 999999999999)),
        employeeType: p.type,
        status: 'ACTIVE',
        hireDate,
        departmentId: p.dept.id,
        jobPositionId: positions[p.position].id,
        workingScheduleId: p.schedule.id,
      },
    });

    createdEmployees.push({
      id: employee.id,
      name: `${p.first} ${p.last}`,
      dept: p.dept.name,
      isManager: Boolean(p.isManager),
      type: p.type,
      scheduleId: p.schedule.id,
      wage: p.wage,
    });

    if (p.isManager) managerByDept[p.dept.name] = employee.id;

    // Give a few employees a login so every role is demonstrable.
    if (p.role) {
      const user = await prisma.user.create({
        data: {
          email,
          name: `${p.first} ${p.last}`,
          passwordHash: password,
          role: p.role,
        },
      });
      await prisma.employee.update({
        where: { id: employee.id },
        data: { userId: user.id },
      });
    }

    // ---- Contracts: an expired historical one plus the current running one.
    const structureId = p.type === 'INTERN' ? internStructure.id : regularStructure.id;

    if (yearsAgo >= 1) {
      const oldStart = hireDate;
      const oldEnd = new Date(today.getFullYear(), today.getMonth() - 6, 0);
      await prisma.contract.create({
        data: {
          name: `${p.first} ${p.last} — Initial Contract`,
          employeeId: employee.id,
          dateStart: oldStart,
          dateEnd: oldEnd,
          status: 'EXPIRED',
          // Previous terms were lower, so the revision is visible in history.
          wage: round2(p.wage * 0.85),
          contractType: p.type === 'INTERN' ? 'INTERNSHIP' : p.type === 'CONTRACT' ? 'FIXED_TERM' : 'PERMANENT',
          jobPositionId: positions[p.position].id,
          workingScheduleId: p.schedule.id,
          salaryStructureId: structureId,
          notes: 'Superseded by revised contract.',
        },
      });
    }

    const currentStart =
      yearsAgo >= 1
        ? new Date(today.getFullYear(), today.getMonth() - 6, 1)
        : hireDate;

    await prisma.contract.create({
      data: {
        name: `${p.first} ${p.last} — Current Contract`,
        employeeId: employee.id,
        dateStart: currentStart,
        // Fixed-term and internships end; permanent roles are open-ended.
        dateEnd:
          p.type === 'CONTRACT'
            ? new Date(today.getFullYear(), today.getMonth() + randInt(1, 3), 28)
            : p.type === 'INTERN'
            ? new Date(today.getFullYear(), today.getMonth() + randInt(1, 4), 28)
            : null,
        status: 'RUNNING',
        wage: p.wage,
        contractType:
          p.type === 'INTERN' ? 'INTERNSHIP' : p.type === 'CONTRACT' ? 'FIXED_TERM' : 'PERMANENT',
        jobPositionId: positions[p.position].id,
        workingScheduleId: p.schedule.id,
        salaryStructureId: structureId,
      },
    });
  }

  // Wire up reporting lines now that every employee exists.
  for (const emp of createdEmployees) {
    const managerId = managerByDept[emp.dept];
    if (managerId && managerId !== emp.id) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { managerId },
      });
    }
  }

  // ---------------------------------------------------------------- Platform users
  console.log('Creating platform users...');

  await prisma.user.create({
    data: {
      email: 'admin@peoplepay360.com',
      name: 'System Administrator',
      passwordHash: password,
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: 'payroll@peoplepay360.com',
      name: 'Payroll Manager',
      passwordHash: password,
      role: 'HR_PAYROLL_MANAGER',
    },
  });

  await prisma.user.create({
    data: {
      email: 'hr@peoplepay360.com',
      name: 'HR Manager',
      passwordHash: password,
      role: 'HR_MANAGER',
    },
  });

  // Give the first employee a self-service login for the Employee role demo.
  const firstEmployee = createdEmployees[2];
  const employeeUser = await prisma.user.create({
    data: {
      email: 'employee@peoplepay360.com',
      name: firstEmployee.name,
      passwordHash: password,
      role: 'EMPLOYEE',
    },
  });
  await prisma.employee.update({
    where: { id: firstEmployee.id },
    data: { userId: employeeUser.id },
  });

  // ---------------------------------------------------------------- Attendance
  console.log('Generating attendance history...');

  const scheduleLinesById: Record<string, { dayOfWeek: number; startTime: string; endTime: string; breakHours: number }[]> = {};
  for (const s of schedules) {
    scheduleLinesById[s.id] = s.lines.map((l) => ({
      dayOfWeek: l.dayOfWeek,
      startTime: l.startTime,
      endTime: l.endTime,
      breakHours: l.breakHours.toNumber(),
    }));
  }

  // Three months back through today.
  const attendanceStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const attendanceRecords: any[] = [];

  for (const emp of createdEmployees) {
    const lines = scheduleLinesById[emp.scheduleId] ?? [];
    const workingDays = new Set(lines.map((l) => l.dayOfWeek));

    const cursor = new Date(attendanceStart);
    while (cursor <= today) {
      const dow = cursor.getDay();
      if (workingDays.has(dow)) {
        const line = lines.find((l) => l.dayOfWeek === dow)!;
        const roll = rand();

        // ~4% of scheduled days are absences with no record at all.
        if (roll > 0.96) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        const [startH, startM] = line.startTime.split(':').map(Number);
        const [endH, endM] = line.endTime.split(':').map(Number);

        // Most people arrive around the scheduled time; some are late.
        const isLate = rand() > 0.85;
        const lateMinutes = isLate ? randInt(20, 75) : randInt(-10, 10);

        const checkIn = new Date(cursor);
        checkIn.setHours(startH, startM + lateMinutes, 0, 0);

        // Night shifts end the following morning.
        const overnight = endH < startH;
        const checkOutBase = new Date(cursor);
        if (overnight) checkOutBase.setDate(checkOutBase.getDate() + 1);

        // ~3% of days the employee forgets to check out.
        const forgotCheckout = rand() > 0.97;

        let checkOut: Date | null = null;
        let workedHours = 0;
        let overtimeHours = 0;
        let status = 'PRESENT';

        const expectedSpan =
          (overnight ? 24 - (startH + startM / 60) + (endH + endM / 60) : endH + endM / 60 - (startH + startM / 60)) -
          line.breakHours;

        if (forgotCheckout) {
          status = 'MISSING_CHECKOUT';
        } else {
          // Occasional overtime.
          const extraMinutes = rand() > 0.8 ? randInt(30, 150) : randInt(-15, 20);
          checkOut = new Date(checkOutBase);
          checkOut.setHours(endH, endM + extraMinutes, 0, 0);

          const raw = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
          workedHours = round2(Math.max(0, raw - line.breakHours));
          overtimeHours = round2(Math.max(0, workedHours - expectedSpan));

          if (isLate) status = 'LATE';
          if (workedHours < expectedSpan / 2) status = 'HALF_DAY';
        }

        // A small number of records were corrected by HR.
        const manuallyEdited = rand() > 0.95;

        attendanceRecords.push({
          employeeId: emp.id,
          checkIn,
          checkOut,
          workedHours,
          overtimeHours,
          status,
          manuallyEdited,
          editedAt: manuallyEdited ? new Date(checkIn.getTime() + 86400000) : null,
          editReason: manuallyEdited ? pick(['Forgot to check out', 'Biometric device failure', 'Approved WFH adjustment']) : null,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Bulk insert in chunks to keep SQLite happy.
  for (let i = 0; i < attendanceRecords.length; i += 500) {
    await prisma.attendance.createMany({ data: attendanceRecords.slice(i, i + 500) });
  }
  console.log(`  ${attendanceRecords.length} attendance records`);

  // ---------------------------------------------------------------- Allocations & leave
  console.log('Creating leave allocations and requests...');

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);

  for (const emp of createdEmployees) {
    // Everyone gets annual and sick allocations for the year.
    await prisma.leaveAllocation.create({
      data: {
        employeeId: emp.id,
        typeId: annualLeave.id,
        quantity: emp.type === 'INTERN' ? 6 : 21,
        validFrom: yearStart,
        validTo: yearEnd,
        status: 'APPROVED',
        approvedBy: 'System',
        approvedAt: yearStart,
        notes: 'Annual entitlement.',
      },
    });

    await prisma.leaveAllocation.create({
      data: {
        employeeId: emp.id,
        typeId: sickLeave.id,
        quantity: emp.type === 'INTERN' ? 4 : 12,
        validFrom: yearStart,
        validTo: yearEnd,
        status: 'APPROVED',
        approvedBy: 'System',
        approvedAt: yearStart,
        notes: 'Annual sick entitlement.',
      },
    });

    // Some employees earned comp-off; one allocation is left pending approval so
    // the approval workflow has something to act on.
    if (rand() > 0.6) {
      await prisma.leaveAllocation.create({
        data: {
          employeeId: emp.id,
          typeId: compOff.id,
          quantity: randInt(1, 3),
          validFrom: new Date(today.getFullYear(), today.getMonth() - 2, 1),
          validTo: new Date(today.getFullYear(), today.getMonth() + 3, 28),
          status: rand() > 0.5 ? 'APPROVED' : 'DRAFT',
          notes: 'Earned for weekend release support.',
        },
      });
    }
  }

  // Leave requests spread across the last three months.
  const leaveReasons = [
    'Family function',
    'Personal work',
    'Medical appointment',
    'Travel',
    'Festival holiday',
    'Not feeling well',
  ];

  let requestCount = 0;
  for (const emp of createdEmployees) {
    const numRequests = randInt(1, 4);

    for (let i = 0; i < numRequests; i++) {
      const type = pick(timeOffTypes);
      const lines = scheduleLinesById[emp.scheduleId] ?? [];
      const workingDays = new Set(lines.map((l) => l.dayOfWeek));

      const monthOffset = randInt(-2, 1);
      const startDay = randInt(1, 24);
      const dateFrom = new Date(today.getFullYear(), today.getMonth() + monthOffset, startDay);
      const span = randInt(1, 3);
      const dateTo = new Date(dateFrom);
      dateTo.setDate(dateTo.getDate() + span - 1);

      // Duration counts only scheduled working days.
      let duration = 0;
      const cur = new Date(dateFrom);
      while (cur <= dateTo) {
        if (workingDays.has(cur.getDay())) duration += 1;
        cur.setDate(cur.getDate() + 1);
      }
      if (duration === 0) continue;

      // Future-dated requests stay pending; past ones are mostly decided.
      const isFuture = dateFrom > today;
      const roll = rand();
      const status = isFuture
        ? 'TO_APPROVE'
        : roll > 0.85
        ? 'REFUSED'
        : roll > 0.15
        ? 'APPROVED'
        : 'TO_APPROVE';

      let allocationId: string | null = null;
      if (type.requiresAllocation && status === 'APPROVED') {
        const alloc = await prisma.leaveAllocation.findFirst({
          where: { employeeId: emp.id, typeId: type.id, status: 'APPROVED' },
        });
        allocationId = alloc?.id ?? null;
        // Without an allocation an allocation-backed leave cannot be approved.
        if (!allocationId) continue;
      }

      await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          typeId: type.id,
          allocationId,
          dateFrom,
          dateTo,
          duration,
          status,
          reason: pick(leaveReasons),
          approvedBy: status === 'APPROVED' ? 'Sanjana Verma' : null,
          approvedAt: status === 'APPROVED' ? new Date(dateFrom.getTime() - 86400000) : null,
          refusedBy: status === 'REFUSED' ? 'Sanjana Verma' : null,
          refusedAt: status === 'REFUSED' ? new Date(dateFrom.getTime() - 86400000) : null,
          refuseReason: status === 'REFUSED' ? 'Insufficient coverage during this period.' : null,
        },
      });
      requestCount += 1;
    }
  }
  console.log(`  ${requestCount} leave requests`);

  // ---------------------------------------------------------------- Historical payruns
  console.log('Creating historical payruns and payslips...');

  // Two completed months so the dashboard's salary trend has real history.
  for (let monthsBack = 2; monthsBack >= 1; monthsBack--) {
    const periodStart = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() - monthsBack + 1, 0, 23, 59, 59);
    const label = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const payrun = await prisma.payrun.create({
      data: {
        name: `Monthly Payroll — ${label}`,
        structureId: regularStructure.id,
        periodStart,
        periodEnd,
        status: 'PAID',
        computedAt: new Date(periodEnd),
        validatedAt: new Date(periodEnd),
        paidAt: new Date(periodEnd.getTime() + 2 * 86400000),
        paidBy: 'Amit Trivedi',
      },
    });

    // Interns run on their own structure, so exclude them from the regular run.
    const eligible = createdEmployees.filter((e) => e.type !== 'INTERN');

    for (let idx = 0; idx < eligible.length; idx++) {
      const emp = eligible[idx];
      const lines = scheduleLinesById[emp.scheduleId] ?? [];
      const workingDays = new Set(lines.map((l) => l.dayOfWeek));

      let scheduledDays = 0;
      const cur = new Date(periodStart);
      while (cur <= periodEnd) {
        if (workingDays.has(cur.getDay())) scheduledDays += 1;
        cur.setDate(cur.getDate() + 1);
      }

      const workedDays = Math.max(0, scheduledDays - randInt(0, 3));
      const overtimeHours = rand() > 0.6 ? randInt(2, 14) : 0;

      // Mirror the Regular Salary rule sequence.
      const basic = round2(emp.wage * Math.min(1, workedDays / Math.max(1, scheduledDays)));
      const hra = round2(basic * 0.4);
      const ta = 2400;
      const ma = 1800;
      const ot = overtimeHours > 0 ? round2(overtimeHours * (basic / 160) * 1.5) : 0;
      const gross = round2(basic + hra + ta + ma + ot);
      const pf = round2(Math.min(basic, 15000) * 0.12);
      const pt = gross > 15000 ? 200 : 0;
      const tds = gross * 12 > 1000000 ? round2(gross * 0.15) : gross * 12 > 500000 ? round2(gross * 0.08) : 0;
      const deductions = round2(pf + pt + tds);
      const net = round2(gross - deductions);

      const number = `PS/${periodStart.getFullYear()}/${String(monthsBack * 100 + idx + 1).padStart(6, '0')}`;

      const contract = await prisma.contract.findFirst({
        where: { employeeId: emp.id, status: 'RUNNING' },
      });

      const payslip = await prisma.payslip.create({
        data: {
          number,
          employeeId: emp.id,
          payrunId: payrun.id,
          contractId: contract?.id ?? null,
          structureId: regularStructure.id,
          periodStart,
          periodEnd,
          status: 'PAID',
          workedDays,
          workedHours: round2(workedDays * 8),
          leaveDays: 0,
          overtimeHours,
          basicWage: basic,
          grossPay: gross,
          totalDeductions: deductions,
          netPay: net,
          warnings: [],
        },
      });

      const payslipLines = [
        line({ code: 'BASIC', name: 'Basic Salary', category: 'BASIC', sequence: 10, amount: basic, quantity: 1, rate: 100 }),
        line({ code: 'HRA', name: 'House Rent Allowance', category: 'ALLOWANCE', sequence: 20, amount: hra, quantity: basic, rate: 40 }),
        line({ code: 'TA', name: 'Transport Allowance', category: 'ALLOWANCE', sequence: 30, amount: ta, quantity: 1, rate: 100 }),
        line({ code: 'MA', name: 'Medical Allowance', category: 'ALLOWANCE', sequence: 40, amount: ma, quantity: 1, rate: 100 }),
        ...(ot > 0 ? [line({ code: 'OT', name: 'Overtime Pay', category: 'ALLOWANCE', sequence: 50, amount: ot, quantity: overtimeHours, rate: 150 })] : []),
        line({ code: 'GROSS', name: 'Gross Salary', category: 'GROSS', sequence: 100, amount: gross, quantity: 1, rate: 100 }),
        line({ code: 'PF', name: 'Provident Fund', category: 'DEDUCTION', sequence: 110, amount: pf, quantity: 1, rate: 12 }),
        ...(pt > 0 ? [line({ code: 'PT', name: 'Professional Tax', category: 'DEDUCTION', sequence: 120, amount: pt, quantity: 1, rate: 100 })] : []),
        ...(tds > 0 ? [line({ code: 'TDS', name: 'Income Tax (TDS)', category: 'DEDUCTION', sequence: 130, amount: tds, quantity: 1, rate: 100 })] : []),
        line({ code: 'NET', name: 'Net Salary', category: 'NET', sequence: 200, amount: net, quantity: 1, rate: 100 }),
      ];

      await prisma.payslipLine.createMany({
        data: payslipLines.map((l) => ({ ...l, payslipId: payslip.id })),
      });
    }

    console.log(`  Payrun "${label}" with ${eligible.length} payslips`);
  }

  // ---------------------------------------------------------------- Summary
  const counts = {
    users: await prisma.user.count(),
    employees: await prisma.employee.count(),
    contracts: await prisma.contract.count(),
    schedules: await prisma.workingSchedule.count(),
    attendance: await prisma.attendance.count(),
    timeOffTypes: await prisma.timeOffType.count(),
    allocations: await prisma.leaveAllocation.count(),
    requests: await prisma.leaveRequest.count(),
    structures: await prisma.salaryStructure.count(),
    rules: await prisma.salaryRule.count(),
    payruns: await prisma.payrun.count(),
    payslips: await prisma.payslip.count(),
  };

  console.log('\nSeed complete:');
  for (const [key, value] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(14)} ${value}`);
  }
  console.log('\nLogins (password: password123)');
  console.log('  admin@peoplepay360.com     Admin');
  console.log('  payroll@peoplepay360.com   HR Payroll Manager');
  console.log('  hr@peoplepay360.com        HR Manager');
  console.log('  employee@peoplepay360.com  Employee (self-service)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
