import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  CreateAttendanceDto,
  UpdateAttendanceDto,
  QueryAttendanceDto,
  AttendanceSummaryQueryDto,
} from './dto/attendance.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NO_MATCH_ID } from '../../common/scoping';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';
@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermission('attendance', 'read')
  findAll(@Query() query: QueryAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.findAll(query, user);
  }

  @Get('summary')
  @RequirePermission('attendance', 'read')
  @ApiOperation({ summary: 'Aggregate presence, exceptions and hours for a range' })
  summary(@Query() query: AttendanceSummaryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const now = new Date();
    return this.attendance.getSummary({
      from: query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1),
      to: query.to ? new Date(`${query.to}T23:59:59.999`) : now,
      // An employee's summary is always narrowed to their own records. A null
      // employeeId means "no filter" downstream, so an unlinked account must
      // fall back to a value that matches nothing rather than seeing everyone.
      employeeId:
        user.role === 'EMPLOYEE'
          ? (user.employeeId ?? NO_MATCH_ID)
          : (query.employeeId ?? null),
      departmentId: query.departmentId ?? null,
    });
  }

  // Declared above the ":id" route below, which would otherwise swallow the
  // literal path as a record id.
  @Get('punch-status')
  @RequirePermission('attendance', 'read')
  @ApiOperation({
    summary: "How many of today's check-ins the signed-in employee has left",
  })
  punchStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.punchStatusFor(user);
  }

  @Post('check-in')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Open an attendance entry for the signed-in employee' })
  checkIn(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.checkIn(user);
  }

  @Post('check-out')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Close the signed-in employee’s open attendance entry' })
  checkOut(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.checkOut(user);
  }

  @Get(':id')
  @RequirePermission('attendance', 'read')
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.findOne(id, user);
  }

  @Post()
  @RequirePermission('attendance', 'create')
  create(@Body() dto: CreateAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('attendance', 'update')
  @ApiOperation({ summary: 'Correct an entry; the change is recorded for audit' })
  update(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attendance.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('attendance', 'delete')
  remove(@Param('id', ParseEntityIdPipe) id: string) {
    return this.attendance.remove(id);
  }
}
