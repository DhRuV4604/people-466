import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { EMPLOYEE_TYPES } from '@peoplepay360/shared';
import type { EmployeeType } from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-08', description: 'Defaults to the latest payroll month' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format.' })
  month?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES })
  @IsOptional()
  @IsEnum(EMPLOYEE_TYPES as unknown as object)
  employeeType?: EmployeeType;
}
