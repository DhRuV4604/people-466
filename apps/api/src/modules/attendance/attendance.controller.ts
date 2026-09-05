import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
      // An employee's summary is always narrowed to their own records.
      employeeId:
        user.role === 'EMPLOYEE' ? user.employeeId : (query.employeeId ?? null),
      departmentId: query.departmentId ?? null,
    });
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
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.attendance.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('attendance', 'delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.remove(id);
  }
}
