/**
 * Transport-shaped contracts for the REST API.
 *
 * Dates cross the wire as ISO strings; the web client converts them at the edge
 * rather than pretending they are `Date` objects.
 */
import type {
  AuditAction,
  Role,
  EmployeeType,
  EmployeeStatus,
  ContractStatus,
  ContractType,
  ScheduleType,
  AttendanceStatus,
  LeaveUnit,
  LeaveRequestStatus,
  AllocationStatus,
  RuleCategory,
  ComputeType,
  PayrunStatus,
  PayslipStatus,
  EmailStatus,
} from './enums';

export type ISODate = string;

// ---------------------------------------------------------------- Envelopes

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  /** Field-level validation failures, when the request body was rejected. */
  details?: Record<string, string[]>;
}

// ---------------------------------------------------------------- Auth

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /**
   * Every account belongs to an employee, so this is only null for a session
   * read before that was true.
   */
  employeeId: string | null;
  /**
   * The password in use was issued rather than chosen. The client sends the
   * person to change it before anything else.
   */
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ---------------------------------------------------------------- Reference data

export interface DepartmentDto {
  id: string;
  name: string;
  code: string | null;
  employeeCount?: number;
}

export interface JobPositionDto {
  id: string;
  name: string;
  employeeCount?: number;
}

export interface WorkingScheduleLineDto {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakHours: number;
}

export interface WorkingScheduleDto {
  id: string;
  name: string;
  scheduleType: ScheduleType;
  timezone: string;
  /** Always derived from the lines; never accepted from a client. */
  hoursPerWeek: number;
  active: boolean;
  lines: WorkingScheduleLineDto[];
  employeeCount?: number;
  contractCount?: number;
}

// ------------------------------------------------------- Organisation policy

/**
 * Settings that apply across the organisation rather than to one record. The
 * API is the enforcement point; the web app reads the same shape so a screen
 * can say up front what the rule is instead of only reporting it as an error.
 */
export interface AppSettingsDto {
  /** How many times an employee may check in on one calendar day. */
  maxCheckInsPerDay: number;
  /** Whether the self-service punch card confirms before closing a shift. */
  warnOnCheckOut: boolean;
}

/** What an install behaves like before anyone edits the policy. */
export const DEFAULT_APP_SETTINGS: AppSettingsDto = {
  maxCheckInsPerDay: 1,
  warnOnCheckOut: true,
};

/** The largest number of daily check-ins the policy will accept. */
/**
 * The ceiling on the punch policy, not the policy itself.
 *
 * High enough to stay out of the way of a real shift pattern — a factory floor
 * on short rotations, a site where people punch in and out around callouts —
 * while still catching a runaway loop or a typo in the settings box.
 */
export const MAX_CHECK_INS_PER_DAY = 48;

/**
 * Where the signed-in employee stands against the daily cap. An open shift
 * counts as used, so closing it never buys another check-in.
 */
export interface PunchStatusDto {
  /** Check-ins already opened today, closed or not. */
  used: number;
  /** The cap in force, from the policy. */
  allowed: number;
  remaining: number;
  /** Whether the punch card should confirm before closing a shift. */
  warnOnCheckOut: boolean;
  /**
   * The shift still running, whenever it was opened.
   *
   * The API refuses a second check-in while any shift is open, of any date, so
   * the card has to know about one from last week as surely as one from this
   * morning. Deriving it from a list of this month's punches left the button
   * saying "Check in" while the API answered "you already have an open
   * check-in" — the two were looking at different windows.
   */
  openCheckIn: { id: string; checkIn: ISODate } | null;
}

// ---------------------------------------------------------------- Employees

export interface EmployeeSummaryDto {
  /** Set when they have a profile picture; the bytes come from the API. */
  avatarFileId?: string | null;
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  workEmail: string;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  department: { id: string; name: string } | null;
  jobPosition: { id: string; name: string } | null;
  manager: { id: string; fullName: string } | null;
  workingSchedule: { id: string; name: string } | null;
  hasBankDetails: boolean;
  hireDate: ISODate;
}

/**
 * The minimum a form needs to offer employees as options. Kept separate from
 * the summary so a dropdown does not pull the whole row and its relations.
 */
export interface EmployeeOptionDto {
  id: string;
  fullName: string;
  employeeCode: string;
}

export interface EmployeeDetailDto extends EmployeeSummaryDto {
  workPhone: string | null;
  dateOfBirth: ISODate | null;
  gender: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  exitDate: ISODate | null;
  departmentId: string | null;
  jobPositionId: string | null;
  managerId: string | null;
  workingScheduleId: string | null;
  counts: {
    contracts: number;
    attendances: number;
    leaveRequests: number;
    leaveAllocations: number;
    payslips: number;
    documents: number;
  };
  /**
   * Only on the create response, and only when the invite did not go out.
   *
   * It carries the one-time password because nothing else can: it is stored
   * hashed and masked in the outbox, so an install with no mail configured
   * would otherwise leave a person with an account nobody can reach. Whoever
   * created the employee is the one person who can pass it on by hand.
   */
  invite?: {
    delivered: boolean;
    /** Why it did not go out. Absent when it did. */
    error?: string;
    /** Present only when undelivered, so it is shown once and never stored. */
    oneTimePassword?: string;
  };
}

// ---------------------------------------------------------------- Contracts

export interface ContractDto {
  id: string;
  name: string;
  employeeId: string;
  employee?: { id: string; fullName: string; department: string | null };
  dateStart: ISODate;
  dateEnd: ISODate | null;
  status: ContractStatus;
  wage: number;
  contractType: ContractType;
  jobPositionId: string | null;
  jobPosition: { id: string; name: string } | null;
  workingScheduleId: string | null;
  workingSchedule: { id: string; name: string } | null;
  salaryStructureId: string | null;
  salaryStructure: { id: string; name: string } | null;
  notes: string | null;
  /** True when this contract governs the period the list was queried for. */
  isApplicableForPeriod?: boolean;
}

// ---------------------------------------------------------------- Attendance

export interface AttendanceDto {
  id: string;
  employeeId: string;
  employee?: { id: string; fullName: string; department: string | null };
  checkIn: ISODate;
  checkOut: ISODate | null;
  workedHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  manuallyEdited: boolean;
  editedById: string | null;
  editedByName?: string | null;
  editedAt: ISODate | null;
  editReason: string | null;
  notes: string | null;
}

export interface AttendanceSummaryDto {
  totalRecords: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  missingCheckout: number;
  manualEdits: number;
  totalWorkedHours: number;
  totalOvertimeHours: number;
  healthPercent: number;
  coveragePercent: number;
}

// ---------------------------------------------------------------- Time off

export interface TimeOffTypeDto {
  id: string;
  name: string;
  code: string;
  unit: LeaveUnit;
  requiresAllocation: boolean;
  requiresApproval: boolean;
  paid: boolean;
  colorHex: string;
  maxDaysPerRequest: number | null;
  active: boolean;
  requestCount?: number;
  allocationCount?: number;
}

export interface LeaveAllocationDto {
  id: string;
  employeeId: string;
  employee?: { id: string; fullName: string; department: string | null };
  typeId: string;
  type: { id: string; name: string; unit: LeaveUnit; colorHex: string };
  quantity: number;
  validFrom: ISODate;
  validTo: ISODate | null;
  status: AllocationStatus;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: ISODate | null;
  /** Derived from approved requests linked to this allocation. */
  taken: number;
  remaining: number;
}

export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  employee?: { id: string; fullName: string; department: string | null };
  typeId: string;
  type: { id: string; name: string; unit: LeaveUnit; colorHex: string; paid: boolean; requiresAllocation: boolean };
  allocationId: string | null;
  dateFrom: ISODate;
  dateTo: ISODate;
  duration: number;
  status: LeaveRequestStatus;
  reason: string | null;
  approvedBy: string | null;
  approvedAt: ISODate | null;
  refusedBy: string | null;
  refusedAt: ISODate | null;
  refuseReason: string | null;
  createdAt: ISODate;
}

export interface LeaveBalanceDto {
  typeId: string;
  typeName: string;
  typeCode: string;
  unit: LeaveUnit;
  colorHex: string;
  requiresAllocation: boolean;
  allocated: number;
  taken: number;
  pending: number;
  remaining: number;
}

// ---------------------------------------------------------------- Salary configuration

export interface SalaryRuleDto {
  id: string;
  name: string;
  code: string;
  structureId: string;
  structure?: { id: string; name: string };
  category: RuleCategory;
  sequence: number;
  computeType: ComputeType;
  amountFixed: number | null;
  amountPercentage: number | null;
  percentageBase: string | null;
  formula: string | null;
  condition: string | null;
  appearsOnPayslip: boolean;
  active: boolean;
  note: string | null;
}

export interface SalaryStructureDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  rules?: SalaryRuleDto[];
  counts?: { rules: number; contracts: number; payslips: number };
}

// ---------------------------------------------------------------- Payroll

export interface PayslipLineDto {
  id: string;
  ruleId: string | null;
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  quantity: number;
  rate: number;
  amount: number;
}

export interface PayslipDto {
  id: string;
  number: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    department: string | null;
    jobPosition: string | null;
  };
  payrunId: string | null;
  payrun: { id: string; name: string } | null;
  contractId: string | null;
  contract: { id: string; name: string } | null;
  structureId: string;
  structure: { id: string; name: string };
  periodStart: ISODate;
  periodEnd: ISODate;
  status: PayslipStatus;
  workedDays: number;
  workedHours: number;
  leaveDays: number;
  overtimeHours: number;
  basicWage: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  warnings: string[];
  lines?: PayslipLineDto[];
}

export interface PayrunDto {
  id: string;
  name: string;
  structureId: string;
  structure: { id: string; name: string };
  periodStart: ISODate;
  periodEnd: ISODate;
  status: PayrunStatus;
  departmentFilter: string | null;
  employeeTypeFilter: string | null;
  computedAt: ISODate | null;
  validatedAt: ISODate | null;
  paidAt: ISODate | null;
  paidBy: string | null;
  createdAt: ISODate;
  payslipCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  payslips?: PayslipDto[];
  warnings?: string[];
}

/** Step 2 of the pay run wizard: who can be paid, and why anyone cannot. */
export interface EligibleEmployeeDto {
  id: string;
  fullName: string;
  employeeCode: string;
  department: string;
  employeeType: EmployeeType;
  wage: number;
  contractName: string;
  eligible: boolean;
  reason: string | null;
  warning: string | null;
}

export interface EmailLogDto {
  id: string;
  payslipId: string | null;
  payrunId: string | null;
  payrun?: { id: string; name: string } | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  attachmentName: string | null;
  status: EmailStatus;
  error: string | null;
  sentAt: ISODate;
}

export interface SendPayslipsResultDto {
  sent: number;
  failed: number;
}

// ---------------------------------------------------------------- Dashboard

/**
 * Something on the dashboard that a person can act on, rather than a number to
 * read. Each carries the ids the action needs, so the work can be finished
 * where it was noticed.
 */
export const DASHBOARD_TASK_KINDS = [
  'PENDING_LEAVE',
  'MISSING_BANK',
  'NO_CONTRACT',
  'NEVER_INVITED',
  'AWAITING_SIGNATURE',
  'DRAFT_PAYRUN',
  'EXPIRING_CONTRACT',
  'MISSING_CHECKOUT',
] as const;
export type DashboardTaskKind = (typeof DASHBOARD_TASK_KINDS)[number];

export interface DashboardTaskSubject {
  /** What the action is aimed at: an employee, a request, a pay run. */
  id: string;
  name: string;
  /** One line of context — a department, a date range, a status. */
  detail: string | null;
  /**
   * The person's picture, where the subject is a person and one is set. Sent
   * alongside so a card can show faces without a request per row.
   */
  avatarFileId?: string | null;
  /** The employee the picture belongs to, when `id` is not them. */
  employeeId?: string | null;
}

export interface DashboardTask {
  kind: DashboardTaskKind;
  count: number;
  /** Capped: the strip shows the first few and says how many more there are. */
  subjects: DashboardTaskSubject[];
}

export interface DashboardDto {
  /**
   * The month every figure here describes.
   *
   * It is not always the current one: the API opens on the latest month that
   * has payroll, so a dashboard read in September may be describing August.
   * Anything phrased as a problem has to name it, or "no contract" reads as
   * "you never made one" when the truth is "not for the month being shown".
   */
  period: { start: ISODate; end: ISODate; label: string };
  kpis: {
    totalNetPaid: number;
    payslipsGenerated: number;
    averageSalary: number;
    approvedTimeOffDays: number;
    attendanceHealth: number;
    headcount: number;
    totalGross: number;
    totalDeductions: number;
  };
  salaryByDepartment: { department: string; totalNet: number; headcount: number }[];
  monthlyTrend: { month: string; netSalary: number; payslips: number }[];
  attendance: AttendanceSummaryDto;
  timeOff: {
    approvedDays: number;
    pendingRequests: number;
    refusedRequests: number;
    byType: { name: string; colorHex: string; days: number; requests: number }[];
  };
  alerts: {
    missingBankDetails: { id: string; name: string; department: string }[];
    noContract: { id: string; name: string; department: string }[];
    expiringContracts: { id: string; name: string; dateEnd: ISODate | null }[];
    duplicatePayslips: { employee: string; numbers: string[] }[];
    draftPayruns: { id: string; name: string; status: string }[];
    pendingAllocations: number;
  };
  /** Ordered most-urgent first by the API, so every client agrees on it. */
  tasks: DashboardTask[];
  payrunStatusBreakdown: { status: string; count: number }[];
  employeeTypeBreakdown: { type: string; count: number }[];
}

// ---------------------------------------------------------------- Audit trail

/** One field that changed, as it was and as it became. */
export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditLogDto {
  id: string;
  /** Null once the account has been removed; userName still names who acted. */
  userId: string | null;
  userName: string;
  userRole: Role;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  changes: AuditChange[];
  method: string;
  path: string;
  ip: string | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------- Notifications

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  actorName: string | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface NotificationSummaryDto {
  unread: number;
  items: NotificationDto[];
}

// ---------------------------------------------------------------- Documents

export const DOCUMENT_KINDS = [
  'JOINING_LETTER',
  'OFFER_LETTER',
  'NDA',
  'CONTRACT',
  'POLICY',
  'ID_PROOF',
  'ADDRESS_PROOF',
  'QUALIFICATION',
  'OTHER',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'AWAITING_SIGNATURE',
  'SUBMITTED',
  'SIGNED',
  'DECLINED',
  'CANCELLED',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface StoredFileDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface DocumentDto {
  id: string;
  title: string;
  kind: DocumentKind;
  status: DocumentStatus;
  message: string | null;
  requiresSignature: boolean;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    employeeCode: string;
    avatarFileId: string | null;
  };
  file: StoredFileDto | null;
  signedFile: StoredFileDto | null;
  createdBy: { id: string; name: string };
  sentAt: ISODate | null;
  submittedAt: ISODate | null;
  signedAt: ISODate | null;
  declinedAt: ISODate | null;
  declineReason: string | null;
  createdAt: ISODate;
}

/** What the certificate page records. Shown to HR beside a signed document. */
export interface DocumentSignatureDto {
  signerName: string | null;
  signerEmail: string | null;
  signerIp: string | null;
  signerUserAgent: string | null;
  signedChecksum: string | null;
  signedAt: ISODate | null;
}

// ---------------------------------------------------------------- The company

/**
 * Who this install is.
 *
 * Read by anyone signed in, because a payslip and a letter both need it and
 * both are read by the person they are about. Only an admin may change it.
 */
export interface CompanyDto {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxId: string | null;
  /** Id of the stored logo, or null. The bytes come from `/company/logo`. */
  logoFileId: string | null;
}

export const DEFAULT_COMPANY: CompanyDto = {
  name: "PeoplePay360",
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  email: null,
  phone: null,
  website: null,
  taxId: null,
  logoFileId: null,
};

/**
 * The address as a document would print it: the lines that were filled in, in
 * postal order, with nothing left showing where a field was skipped.
 */
export function companyAddressLines(company: CompanyDto): string[] {
  return [
    company.addressLine1,
    company.addressLine2,
    [company.city, company.state].filter(Boolean).join(", "),
    [company.postalCode, company.country].filter(Boolean).join(" "),
  ]
    .map((line) => (line ?? "").trim())
    .filter(Boolean);
}
