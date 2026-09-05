import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EMPLOYEE_TYPES, EMPLOYEE_STATUSES } from '@peoplepay360/shared';
import type { EmployeeType, EmployeeStatus } from '@peoplepay360/shared';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Priya' })
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Patel' })
  @IsString()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'priya.patel@peoplepay360.com' })
  @IsEmail({}, { message: 'A valid work email is required.' })
  workEmail!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  workPhone?: string | null;

  @ApiPropertyOptional({ example: '1994-04-12', nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  gender?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Absence raises a payroll warning' })
  @IsOptional()
  @IsString()
  bankName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string | null;

  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES, default: 'FULL_TIME' })
  @IsOptional()
  @IsEnum(EMPLOYEE_TYPES as unknown as object)
  employeeType?: EmployeeType;

  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(EMPLOYEE_STATUSES as unknown as object)
  status?: EmployeeStatus;

  @ApiProperty({ example: '2024-06-01' })
  @IsDateString({}, { message: 'hireDate must be a valid date.' })
  hireDate!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  exitDate?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  jobPositionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  workingScheduleId?: string | null;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class QueryEmployeesDto {
  @ApiPropertyOptional({ description: 'Search name, email or employee code' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES })
  @IsOptional()
  @IsEnum(EMPLOYEE_TYPES as unknown as object)
  employeeType?: EmployeeType;

  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES })
  @IsOptional()
  @IsEnum(EMPLOYEE_STATUSES as unknown as object)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'Only employees with incomplete bank details' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  missingBank?: boolean;
}
