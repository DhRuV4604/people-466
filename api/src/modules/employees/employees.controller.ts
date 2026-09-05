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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, QueryEmployeesDto } from './dto/employee.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermission('employees', 'read')
  @ApiOperation({ summary: 'List employees; the Employee role sees only itself' })
  findAll(@Query() query: QueryEmployeesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.findAll(query, user);
  }

  // Declared before `:id` so the literal path wins; Nest matches in order and
  // would otherwise read "options" as an employee id.
  @Get('options')
  @RequirePermission('employees', 'read')
  @ApiOperation({ summary: 'Id and label pairs for form dropdowns' })
  findOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.employees.findOptions(user);
  }

  @Get(':id')
  @RequirePermission('employees', 'read')
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.findOne(id, user);
  }

  @Post()
  @RequirePermission('employees', 'create')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('employees', 'update')
  update(
    @Param('id', ParseEntityIdPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.employees.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('employees', 'delete')
  @ApiOperation({ summary: 'Delete, or archive instead when payslips exist' })
  remove(@Param('id', ParseEntityIdPipe) id: string) {
    return this.employees.remove(id);
  }
}
