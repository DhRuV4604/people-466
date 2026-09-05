import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigDataService } from './config-data.service';
import {
  UpsertScheduleDto,
  UpsertDepartmentDto,
  UpsertPositionDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/config.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('configuration')
@ApiBearerAuth()
@Controller()
export class ConfigDataController {
  constructor(private readonly config: ConfigDataService) {}

  // ---------------------------------------------------------------- Schedules

  @Get('working-schedules')
  @RequirePermission('workingSchedules', 'read')
  findSchedules() {
    return this.config.findSchedules();
  }

  @Get('working-schedules/:id')
  @RequirePermission('workingSchedules', 'read')
  findSchedule(@Param('id', ParseUUIDPipe) id: string) {
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
  updateSchedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertScheduleDto) {
    return this.config.updateSchedule(id, dto);
  }

  @Delete('working-schedules/:id')
  @RequirePermission('workingSchedules', 'delete')
  removeSchedule(@Param('id', ParseUUIDPipe) id: string) {
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
  updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertDepartmentDto) {
    return this.config.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @RequirePermission('employees', 'delete')
  removeDepartment(@Param('id', ParseUUIDPipe) id: string) {
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
  updatePosition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertPositionDto) {
    return this.config.updatePosition(id, dto);
  }

  @Delete('job-positions/:id')
  @RequirePermission('employees', 'delete')
  removePosition(@Param('id', ParseUUIDPipe) id: string) {
    return this.config.removePosition(id);
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
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.config.updateUser(id, dto);
  }

  @Delete('users/:id')
  @RequirePermission('users', 'delete')
  removeUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.config.removeUser(id, user);
  }
}
