-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('FULL_TIME', 'PART_TIME', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'RUNNING', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'MISSING_CHECKOUT', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "LeaveUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'APPROVED', 'REFUSED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'TO_APPROVE', 'APPROVED', 'REFUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleCategory" AS ENUM ('BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'CONTRIBUTION', 'NET');

-- CreateEnum
CREATE TYPE "ComputeType" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA');

-- CreateEnum
CREATE TYPE "PayrunStatus" AS ENUM ('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REFUSE', 'CANCEL', 'COMPUTE', 'VALIDATE', 'PAY', 'SEND', 'LOGIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT NOT NULL,
    "workPhone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "employeeType" "EmployeeType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "departmentId" UUID,
    "jobPositionId" UUID,
    "managerId" UUID,
    "workingScheduleId" UUID,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingSchedule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'FULL_TIME',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "hoursPerWeek" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingScheduleLine" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakHours" DECIMAL(8,2) NOT NULL DEFAULT 0,

    CONSTRAINT "WorkingScheduleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "wage" DECIMAL(12,2) NOT NULL,
    "contractType" "ContractType" NOT NULL DEFAULT 'PERMANENT',
    "jobPositionId" UUID,
    "workingScheduleId" UUID,
    "salaryStructureId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "workedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "editReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffType" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" "LeaveUnit" NOT NULL DEFAULT 'DAY',
    "requiresAllocation" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "colorHex" TEXT NOT NULL DEFAULT '#2563eb',
    "maxDaysPerRequest" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveAllocation" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "typeId" UUID NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "typeId" UUID NOT NULL,
    "allocationId" UUID,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "duration" DECIMAL(8,2) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'TO_APPROVE',
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "refusedBy" TEXT,
    "refusedAt" TIMESTAMP(3),
    "refuseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRule" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "structureId" UUID NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 100,
    "computeType" "ComputeType" NOT NULL DEFAULT 'FIXED',
    "amountFixed" DECIMAL(12,2),
    "amountPercentage" DECIMAL(9,4),
    "percentageBase" TEXT,
    "formula" TEXT,
    "condition" TEXT,
    "appearsOnPayslip" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payrun" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "structureId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrunStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentFilter" TEXT,
    "employeeTypeFilter" TEXT,
    "computedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payrun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "payrunId" UUID,
    "contractId" UUID,
    "structureId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "workedDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "workedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "leaveDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "basicWage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "warnings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" UUID NOT NULL,
    "payslipId" UUID NOT NULL,
    "ruleId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 100,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "rate" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" UUID NOT NULL,
    "payslipId" UUID,
    "payrunId" UUID,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentName" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "entityLabel" TEXT,
    "changes" JSONB,
    "snapshot" JSONB,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "actorName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "maxCheckInsPerDay" INTEGER NOT NULL DEFAULT 1,
    "warnOnCheckOut" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_name_key" ON "JobPosition"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingSchedule_name_key" ON "WorkingSchedule"("name");

-- CreateIndex
CREATE INDEX "WorkingScheduleLine_scheduleId_idx" ON "WorkingScheduleLine"("scheduleId");

-- CreateIndex
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");

-- CreateIndex
CREATE INDEX "Contract_dateStart_dateEnd_idx" ON "Contract"("dateStart", "dateEnd");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_checkIn_idx" ON "Attendance"("employeeId", "checkIn");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffType_name_key" ON "TimeOffType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimeOffType_code_key" ON "TimeOffType"("code");

-- CreateIndex
CREATE INDEX "LeaveAllocation_employeeId_typeId_idx" ON "LeaveAllocation"("employeeId", "typeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_dateFrom_idx" ON "LeaveRequest"("employeeId", "dateFrom");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_name_key" ON "SalaryStructure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_code_key" ON "SalaryStructure"("code");

-- CreateIndex
CREATE INDEX "SalaryRule_structureId_sequence_idx" ON "SalaryRule"("structureId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRule_structureId_code_key" ON "SalaryRule"("structureId", "code");

-- CreateIndex
CREATE INDEX "Payrun_periodStart_periodEnd_idx" ON "Payrun"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Payrun_status_idx" ON "Payrun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_number_key" ON "Payslip"("number");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_periodStart_idx" ON "Payslip"("employeeId", "periodStart");

-- CreateIndex
CREATE INDEX "Payslip_payrunId_idx" ON "Payslip"("payrunId");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "PayslipLine_payslipId_sequence_idx" ON "PayslipLine"("payslipId", "sequence");

-- CreateIndex
CREATE INDEX "EmailLog_payrunId_idx" ON "EmailLog"("payrunId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingScheduleLine" ADD CONSTRAINT "WorkingScheduleLine_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_jobPositionId_fkey" FOREIGN KEY ("jobPositionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAllocation" ADD CONSTRAINT "LeaveAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAllocation" ADD CONSTRAINT "LeaveAllocation_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TimeOffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "LeaveAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRule" ADD CONSTRAINT "SalaryRule_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payrun" ADD CONSTRAINT "Payrun_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SalaryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_payrunId_fkey" FOREIGN KEY ("payrunId") REFERENCES "Payrun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
