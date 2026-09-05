import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLogDto, Paginated } from '@peoplepay360/shared';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/audit-log.dto';
import { RequirePermission } from '../../common/decorators';

/**
 * Read only, on purpose. The RBAC matrix grants auditLogs read to the admin and
 * to nobody else, and grants write to nobody at all - including the admin.
 */
@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('auditLogs', 'read')
  @ApiOperation({ summary: 'Who changed what, newest first' })
  findAll(@Query() query: QueryAuditLogsDto): Promise<Paginated<AuditLogDto>> {
    return this.audit.findAll(query);
  }
}
