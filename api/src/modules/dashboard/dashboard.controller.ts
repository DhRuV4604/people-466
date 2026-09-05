import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';
import { RequirePermission } from '../../common/decorators';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermission('dashboard', 'read')
  @ApiOperation({ summary: 'Live HR and payroll metrics for the selected filters' })
  async getDashboard(@Query() query: DashboardQueryDto) {
    // Fall back to the latest month that has payroll so the dashboard opens on
    // something meaningful rather than an empty current month.
    const month = query.month ?? (await this.dashboard.getLatestPayrollMonth());
    const base = month ? new Date(`${month}-01T00:00:00`) : new Date();

    return this.dashboard.getDashboard({
      periodStart: new Date(base.getFullYear(), base.getMonth(), 1),
      periodEnd: new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999),
      departmentId: query.departmentId ?? null,
      employeeType: query.employeeType ?? null,
    });
  }
}
