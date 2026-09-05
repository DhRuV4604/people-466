import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ATTENDANCE_STATUSES } from '@peoplepay360/shared';
import type { AttendanceStatus } from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';

export class CreateAttendanceDto {
  @ApiPropertyOptional({
    description: 'Ignored for the Employee role, which always records its own attendance',
  })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiProperty({ example: '2026-09-07T09:00:00.000Z' })
  @IsDateString({}, { message: 'checkIn must be a valid date-time.' })
  checkIn!: string;

  @ApiPropertyOptional({ example: '2026-09-07T18:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'checkOut must be a valid date-time.' })
  checkOut?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateAttendanceDto extends PartialType(CreateAttendanceDto) {
  @ApiPropertyOptional({
    enum: ATTENDANCE_STATUSES,
    description: 'Overrides the derived status; the record is flagged as manually edited',
  })
  @IsOptional()
  @IsEnum(ATTENDANCE_STATUSES as unknown as object)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ example: 'Biometric device failure' })
  @IsOptional()
  @IsString()
  editReason?: string;
}

export class QueryAttendanceDto {
  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ enum: ATTENDANCE_STATUSES })
  @IsOptional()
  @IsEnum(ATTENDANCE_STATUSES as unknown as object)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  to?: string;

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

export class AttendanceSummaryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  departmentId?: string;
}
