import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AUDIT_ACTIONS } from '@peoplepay360/shared';
import type { AuditAction } from '@peoplepay360/shared';
import { IsEntityId } from '../../../common/validation/entity-id';
import { PaginationQueryDto } from '../../../common/pagination';

export class QueryAuditLogsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches who acted or what they acted on' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Record id' })
  @IsOptional()
  @IsEntityId()
  userId?: string;

  @ApiPropertyOptional({ example: 'Employee', description: 'Model name' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entity?: string;

  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsEnum(AUDIT_ACTIONS as unknown as object)
  action?: AuditAction;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Inclusive of the whole day' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
