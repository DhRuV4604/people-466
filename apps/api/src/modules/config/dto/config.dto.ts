import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ROLES, SCHEDULE_TYPES } from '@peoplepay360/shared';
import type { Role, ScheduleType } from '@peoplepay360/shared';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleLineDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Sunday .. 6=Saturday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_PATTERN, { message: 'startTime must be in HH:MM format.' })
  startTime!: string;

  @ApiProperty({ example: '18:00' })
  @Matches(TIME_PATTERN, { message: 'endTime must be in HH:MM format.' })
  endTime!: string;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  breakHours?: number;
}

export class UpsertScheduleDto {
  @ApiProperty({ example: 'Standard 40 Hours/Week' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: SCHEDULE_TYPES, default: 'FULL_TIME' })
  @IsOptional()
  @IsEnum(SCHEDULE_TYPES as unknown as object)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({ default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    type: [ScheduleLineDto],
    description: 'Weekly pattern; total hours are derived from these lines',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleLineDto)
  lines!: ScheduleLineDto[];
}

export class UpsertDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'ENG', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string | null;
}

export class UpsertPositionDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'new.user@peoplepay360.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'New User' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ROLES })
  @IsEnum(ROLES as unknown as object)
  role!: Role;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsEnum(ROLES as unknown as object)
  role?: Role;

  @ApiPropertyOptional({ minLength: 8, description: 'Omit to keep the current password' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
