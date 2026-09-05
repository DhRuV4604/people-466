import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CONTRACT_STATUSES, CONTRACT_TYPES } from '@peoplepay360/shared';
import type { ContractStatus, ContractType } from '@peoplepay360/shared';

export class CreateContractDto {
  @ApiProperty({ example: 'Priya Patel — Senior Engineer 2026' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId!: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'dateStart must be a valid date.' })
  dateStart!: string;

  @ApiPropertyOptional({ example: '2026-12-31', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'dateEnd must be a valid date.' })
  dateEnd?: string | null;

  @ApiPropertyOptional({ enum: CONTRACT_STATUSES, default: 'DRAFT' })
  @IsOptional()
  @IsEnum(CONTRACT_STATUSES as unknown as object)
  status?: ContractStatus;

  @ApiProperty({ example: 85000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Wage cannot be negative.' })
  wage!: number;

  @ApiPropertyOptional({ enum: CONTRACT_TYPES, default: 'PERMANENT' })
  @IsOptional()
  @IsEnum(CONTRACT_TYPES as unknown as object)
  contractType?: ContractType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  jobPositionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  workingScheduleId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  salaryStructureId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateContractDto extends PartialType(CreateContractDto) {}

export class QueryContractsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @ApiPropertyOptional({ enum: CONTRACT_STATUSES })
  @IsOptional()
  @IsEnum(CONTRACT_STATUSES as unknown as object)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Only contracts ending within 30 days' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  expiring?: boolean;

  @ApiPropertyOptional({ description: 'Search contract name or employee name' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Reference period for the applicable-contract flag' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
