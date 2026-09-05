import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, QueryEmployeesDto } from './dto/employee.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';
import {
  StorageService,
  type UploadedFile as StoredUpload,
} from '../files/storage.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly storage: StorageService
  ) {}

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

  /**
   * Issues a fresh one-time password and mails it.
   *
   * Needs `update` rather than a permission of its own: it is a change to
   * someone's account, and anyone trusted to edit an employee is trusted to
   * ask them to sign in. It is also the only way back for the accounts the
   * migration created without a usable password.
   */
  /**
   * The picture. Read is `employees:read`, which the Employee role holds for
   * itself alone, so a person can see their own and HR can see everyone's.
   */
  @Get(':id/avatar')
  @RequirePermission('employees', 'read')
  async avatar(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const fileId = await this.employees.avatarFileId(id, user);
    const file = await this.storage.read(fileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.size);
    // A new picture is a new file with a new id, so this one never changes.
    response.setHeader('Cache-Control', 'private, max-age=3600');
    file.stream.pipe(response);
  }

  /**
   * Anyone may set their own; the service decides, because "my own" is not
   * something the permission matrix can express.
   */
  @Post(':id/avatar')
  @RequirePermission('employees', 'read')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Set a profile picture' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  setAvatar(
    @Param('id', ParseEntityIdPipe) id: string,
    @UploadedFile() file: StoredUpload | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.employees.setAvatar(id, file, user);
  }

  @Post(':id/reinvite')
  @RequirePermission('employees', 'update')
  @ApiOperation({ summary: 'Send a new one-time password to an employee' })
  reinvite(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.employees.reinvite(id, user);
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
  remove(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.employees.remove(id, user);
  }
}
