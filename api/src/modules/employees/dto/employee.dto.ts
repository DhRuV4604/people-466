import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsEntityId } from '../../../common/validation/entity-id';
import { EMPLOYEE_TYPES, EMPLOYEE_STATUSES, ROLES } from '@peoplepay360/shared';
import type { EmployeeType, EmployeeStatus, Role } from '@peoplepay360/shared';
import { PaginationQueryDto } from '../../../common/pagination';

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

  @ApiPropertyOptional({ description: 'Record id', nullable: true })
  @IsOptional()
  @IsEntityId()
  departmentId?: string | null;

  @ApiPropertyOptional({ description: 'Record id', nullable: true })
  @IsOptional()
  @IsEntityId()
  jobPositionId?: string | null;

  @ApiPropertyOptional({ description: 'Record id', nullable: true })
  @IsOptional()
  @IsEntityId()
  managerId?: string | null;

  @ApiPropertyOptional({ description: 'Record id', nullable: true })
  @IsOptional()
  @IsEntityId()
  workingScheduleId?: string | null;

  @ApiPropertyOptional({
    enum: ROLES,
    default: 'EMPLOYEE',
    description: 'What this person may do. Everyone gets a sign-in; this decides its reach.',
  })
  @IsOptional()
  @IsEnum(ROLES as unknown as object)
  role?: Role;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether the account is usable. Off creates the person without inviting them.',
  })
  @IsOptional()
  @IsBoolean()
  canSignIn?: boolean;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class QueryEmployeesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search name, email or employee code' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
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

  // Bounded like the other list endpoints, so an unfiltered read cannot pull
  // the whole table into a page render.
  @ApiPropertyOptional({ default: 300, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
