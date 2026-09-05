import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  COMPUTE_TYPES,
  EMPLOYEE_TYPES,
  PAYRUN_STATUSES,
  PAYSLIP_STATUSES,
  RULE_CATEGORIES,
} from '@peoplepay360/shared';
import type {
  ComputeType,
  EmployeeType,
  PayrunStatus,
  PayslipStatus,
  RuleCategory,
} from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';
import { PaginationQueryDto } from '../../../common/pagination';

// ---------------------------------------------------------------- Structures

export class UpsertStructureDto {
  @ApiProperty({ example: 'Regular Salary' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'REG' })
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'Code may contain letters, digits and underscores only.' })
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ---------------------------------------------------------------- Rules

export class UpsertRuleDto {
  @ApiProperty({ example: 'House Rent Allowance' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'HRA', description: 'Referenced by later rules in formulas' })
  @IsString()
  @Matches(/^[A-Za-z0-9_ ]+$/, { message: 'Code may contain letters, digits and underscores only.' })
  @MaxLength(30)
  code!: string;

  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  structureId!: string;

  @ApiProperty({ enum: RULE_CATEGORIES })
  @IsEnum(RULE_CATEGORIES as unknown as object)
  category!: RuleCategory;

  @ApiPropertyOptional({ default: 100, description: 'Lower values compute first' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sequence?: number;

  @ApiPropertyOptional({ enum: COMPUTE_TYPES, default: 'FIXED' })
  @IsOptional()
  @IsEnum(COMPUTE_TYPES as unknown as object)
  computeType?: ComputeType;

  @ApiPropertyOptional({ example: 2400 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amountFixed?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  amountPercentage?: number;

  @ApiPropertyOptional({ example: 'BASIC' })
  @IsOptional()
  @IsString()
  percentageBase?: string;

  @ApiPropertyOptional({ example: 'GROSS - PF - PT - TDS' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  formula?: string;

  @ApiPropertyOptional({ example: 'GROSS > 15000', description: 'Rule is skipped when false' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  condition?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  appearsOnPayslip?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

export class QueryRulesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  structureId?: string;

  @ApiPropertyOptional({ enum: RULE_CATEGORIES })
  @IsOptional()
  @IsEnum(RULE_CATEGORIES as unknown as object)
  category?: RuleCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

// ---------------------------------------------------------------- Pay runs

export class EligibilityQueryDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  structureId!: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES })
  @IsOptional()
  @IsEnum(EMPLOYEE_TYPES as unknown as object)
  employeeType?: EmployeeType;
}

export class CreatePayrunDto {
  @ApiProperty({ example: 'Monthly Payroll — August 2026' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  structureId!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  periodEnd!: string;

  @ApiProperty({ type: [String], description: 'Explicitly selected employees' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one employee for this pay run.' })
  @IsEntityId({ each: true })
  employeeIds!: string[];

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES })
  @IsOptional()
  @IsEnum(EMPLOYEE_TYPES as unknown as object)
  employeeType?: EmployeeType;
}

export class QueryPayrunsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PAYRUN_STATUSES })
  @IsOptional()
  @IsEnum(PAYRUN_STATUSES as unknown as object)
  status?: PayrunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

// ---------------------------------------------------------------- Payslips

export class QueryPayslipsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  payrunId?: string;

  @ApiPropertyOptional({ enum: PAYSLIP_STATUSES })
  @IsOptional()
  @IsEnum(PAYSLIP_STATUSES as unknown as object)
  status?: PayslipStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 300, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
