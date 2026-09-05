import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ALLOCATION_STATUSES,
  LEAVE_REQUEST_STATUSES,
  LEAVE_UNITS,
} from '@peoplepay360/shared';
import type { AllocationStatus, LeaveRequestStatus, LeaveUnit } from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';

// ---------------------------------------------------------------- Types

export class UpsertTimeOffTypeDto {
  @ApiProperty({ example: 'Annual Leave' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'ANNUAL' })
  @IsString()
  @Matches(/^[A-Za-z0-9_]+$/, { message: 'Code may contain letters, digits and underscores only.' })
  @MaxLength(30)
  code!: string;

  @ApiPropertyOptional({ enum: LEAVE_UNITS, default: 'DAY' })
  @IsOptional()
  @IsEnum(LEAVE_UNITS as unknown as object)
  unit?: LeaveUnit;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresAllocation?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Unpaid leave reduces net pay' })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxDaysPerRequest?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// ---------------------------------------------------------------- Allocations

export class CreateAllocationDto {
  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  employeeId!: string;

  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  typeId!: string;

  @ApiProperty({ example: 21 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Quantity must be greater than zero.' })
  quantity!: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  validFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31', nullable: true })
  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @ApiPropertyOptional({ enum: ALLOCATION_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(ALLOCATION_STATUSES as unknown as object)
  status?: AllocationStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateAllocationDto extends PartialType(CreateAllocationDto) {}

export class QueryAllocationsDto {
  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  typeId?: string;

  @ApiPropertyOptional({ enum: ALLOCATION_STATUSES })
  @IsOptional()
  @IsEnum(ALLOCATION_STATUSES as unknown as object)
  status?: AllocationStatus;
}

// ---------------------------------------------------------------- Requests

export class CreateLeaveRequestDto {
  @ApiPropertyOptional({
    description: 'Ignored for the Employee role, which always files its own requests',
  })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiProperty({ description: 'Record id' })
  @IsEntityId()
  typeId!: string;

  @ApiProperty({ example: '2026-09-07' })
  @IsDateString()
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-11' })
  @IsDateString()
  dateTo!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class UpdateLeaveRequestDto extends PartialType(CreateLeaveRequestDto) {}

export class RefuseRequestDto {
  @ApiPropertyOptional({ example: 'Insufficient coverage during this period.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QueryLeaveRequestsDto {
  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  typeId?: string;

  @ApiPropertyOptional({ enum: LEAVE_REQUEST_STATUSES })
  @IsOptional()
  @IsEnum(LEAVE_REQUEST_STATUSES as unknown as object)
  status?: LeaveRequestStatus;

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
