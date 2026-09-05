import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppSettingsService } from './app-settings.service';
import { ConfigDataService } from './config-data.service';
import {
  UpsertScheduleDto,
  UpsertDepartmentDto,
  UpsertPositionDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateAppSettingsDto,
} from './dto/config.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';

@ApiTags('configuration')
@ApiBearerAuth()
@Controller()
export class ConfigDataController {
  constructor(
    private readonly config: ConfigDataService,
    private readonly settings: AppSettingsService,
  ) {}

  // ---------------------------------------------------------------- Schedules

  @Get('working-schedules')
  @RequirePermission('workingSchedules', 'read')
  findSchedules() {
    return this.config.findSchedules();
  }

  @Get('working-schedules/:id')
  @RequirePermission('workingSchedules', 'read')
  findSchedule(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.findSchedule(id);
  }

  @Post('working-schedules')
  @RequirePermission('workingSchedules', 'create')
  @ApiOperation({ summary: 'Create a schedule; weekly hours are derived from the lines' })
  createSchedule(@Body() dto: UpsertScheduleDto) {
    return this.config.createSchedule(dto);
  }

  @Patch('working-schedules/:id')
  @RequirePermission('workingSchedules', 'update')
  updateSchedule(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertScheduleDto) {
    return this.config.updateSchedule(id, dto);
  }

  @Delete('working-schedules/:id')
  @RequirePermission('workingSchedules', 'delete')
  removeSchedule(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.removeSchedule(id);
  }

  // ---------------------------------------------------------------- Departments

  @Get('departments')
  @RequirePermission('employees', 'read')
  findDepartments() {
    return this.config.findDepartments();
  }

  @Post('departments')
  @RequirePermission('employees', 'create')
  createDepartment(@Body() dto: UpsertDepartmentDto) {
    return this.config.createDepartment(dto);
  }

  @Patch('departments/:id')
  @RequirePermission('employees', 'update')
  updateDepartment(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertDepartmentDto) {
    return this.config.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @RequirePermission('employees', 'delete')
  removeDepartment(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.removeDepartment(id);
  }

  // ---------------------------------------------------------------- Positions

  @Get('job-positions')
  @RequirePermission('employees', 'read')
  findPositions() {
    return this.config.findPositions();
  }

  @Post('job-positions')
  @RequirePermission('employees', 'create')
  createPosition(@Body() dto: UpsertPositionDto) {
    return this.config.createPosition(dto);
  }

  @Patch('job-positions/:id')
  @RequirePermission('employees', 'update')
  updatePosition(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertPositionDto) {
    return this.config.updatePosition(id, dto);
  }

  @Delete('job-positions/:id')
  @RequirePermission('employees', 'delete')
  removePosition(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.removePosition(id);
  }

  // ------------------------------------------------------------ App settings
  // Organisation policy sits behind the schedules permission: it is the same
  // "how work is counted" configuration, and the roles that may edit one are
  // the roles that may edit the other.

  @Get('app-settings')
  @RequirePermission('workingSchedules', 'read')
  @ApiOperation({ summary: 'Organisation-wide policy, with defaults when unset' })
  getAppSettings() {
    return this.settings.get();
  }

  @Patch('app-settings')
  @RequirePermission('workingSchedules', 'update')
  @ApiOperation({ summary: 'Change policy; an omitted field keeps its stored value' })
  updateAppSettings(@Body() dto: UpdateAppSettingsDto) {
    return this.settings.update(dto);
  }

  // ---------------------------------------------------------------- Users

  @Get('users')
  @RequirePermission('users', 'read')
  findUsers() {
    return this.config.findUsers();
  }

  @Post('users')
  @RequirePermission('users', 'create')
  createUser(@Body() dto: CreateUserDto) {
    return this.config.createUser(dto);
  }

  @Patch('users/:id')
  @RequirePermission('users', 'update')
  updateUser(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.config.updateUser(id, dto);
  }

  @Delete('users/:id')
  @RequirePermission('users', 'delete')
  removeUser(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.config.removeUser(id, user);
  }
}
