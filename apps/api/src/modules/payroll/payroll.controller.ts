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
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { can } from '@peoplepay360/shared';
import { PayrunsService } from './payruns.service';
import { PayslipsService } from './payslips.service';
import { SalaryConfigService } from './salary-config.service';
import { PdfService } from './pdf.service';
import { MailService } from './mail.service';
import {
  CreatePayrunDto,
  QueryPayrunsDto,
  QueryPayslipsDto,
  EligibilityQueryDto,
  UpsertStructureDto,
  UpsertRuleDto,
  QueryRulesDto,
} from './dto/payroll.dto';
import { RequirePermission, CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { ParseEntityIdPipe } from '../../common/validation/entity-id';

// ---------------------------------------------------------------- Pay runs

@ApiTags('payruns')
@ApiBearerAuth()
@Controller('payruns')
export class PayrunsController {
  constructor(private readonly payruns: PayrunsService) {}

  @Get()
  @RequirePermission('payruns', 'read')
  findAll(@Query() query: QueryPayrunsDto) {
    return this.payruns.findAll(query);
  }

  @Get('eligible-employees')
  @RequirePermission('payruns', 'create')
  @ApiOperation({
    summary: 'Wizard step 2: who can be paid for this period, and why anyone cannot',
  })
  eligible(@Query() query: EligibilityQueryDto) {
    return this.payruns.getEligibleEmployees(query);
  }

  @Get(':id')
  @RequirePermission('payruns', 'read')
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payruns.findOne(id, user);
  }

  @Post()
  @RequirePermission('payruns', 'create')
  @ApiOperation({ summary: 'Create the batch with only the selected employees' })
  create(@Body() dto: CreatePayrunDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payruns.create(dto, user);
  }

  @Post(':id/compute')
  @RequirePermission('payruns', 'update')
  @ApiOperation({ summary: 'Compute every payslip from contract, attendance and leave' })
  compute(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payruns.compute(id, user);
  }

  @Post(':id/validate')
  @RequirePermission('payruns', 'update')
  @ApiOperation({ summary: 'Validate; blocked while blocking warnings remain' })
  validate(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payruns.validate(id, user);
  }

  @Post(':id/mark-paid')
  @RequirePermission('payruns', 'update')
  markPaid(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payruns.markPaid(id, user);
  }

  @Post(':id/send-payslips')
  @RequirePermission('payruns', 'update')
  @ApiOperation({ summary: 'Bulk-deliver payslip PDFs to each employee' })
  sendPayslips(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.payruns.sendPayslips(id, user);
  }

  @Delete(':id')
  @RequirePermission('payruns', 'delete')
  @ApiOperation({ summary: 'Delete a pay run; paid runs are preserved as history' })
  remove(@Param('id', ParseEntityIdPipe) id: string) {
    return this.payruns.remove(id);
  }
}

// ---------------------------------------------------------------- Payslips

@ApiTags('payslips')
@ApiBearerAuth()
@Controller('payslips')
export class PayslipsController {
  constructor(
    private readonly payslips: PayslipsService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @RequirePermission('payslips', 'read')
  findAll(@Query() query: QueryPayslipsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payslips.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('payslips', 'read')
  findOne(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payslips.findOne(id, user);
  }

  @Post(':id/recompute')
  @RequirePermission('payslips', 'update')
  recompute(@Param('id', ParseEntityIdPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payslips.recompute(id, user);
  }

  /**
   * Not annotated with @RequirePermission: an employee has no payslips
   * permission yet must be able to print their own, so the check is inline.
   */
  @Get(':id/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the payslip as a PDF' })
  async downloadPdf(
    @Param('id', ParseEntityIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response
  ): Promise<void> {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true },
    });
    if (!payslip) throw new ForbiddenException('Payslip not found.');

    const allowed =
      can(user.role, 'payslips', 'read') || user.employeeId === payslip.employeeId;
    if (!allowed) throw new ForbiddenException('Not authorized to view this payslip.');

    const { buffer, filename } = await this.pdf.generatePayslip(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  }
}

// ---------------------------------------------------------------- Salary configuration

@ApiTags('salary-config')
@ApiBearerAuth()
@Controller()
export class SalaryConfigController {
  constructor(
    private readonly config: SalaryConfigService,
    private readonly mail: MailService
  ) {}

  @Get('salary-structures')
  @RequirePermission('salaryStructures', 'read')
  findStructures() {
    return this.config.findStructures();
  }

  @Get('salary-structures/:id')
  @RequirePermission('salaryStructures', 'read')
  findStructure(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.findStructure(id);
  }

  @Post('salary-structures')
  @RequirePermission('salaryStructures', 'create')
  createStructure(@Body() dto: UpsertStructureDto) {
    return this.config.createStructure(dto);
  }

  @Patch('salary-structures/:id')
  @RequirePermission('salaryStructures', 'update')
  updateStructure(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertStructureDto) {
    return this.config.updateStructure(id, dto);
  }

  @Delete('salary-structures/:id')
  @RequirePermission('salaryStructures', 'delete')
  removeStructure(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.removeStructure(id);
  }

  @Get('salary-rules')
  @RequirePermission('salaryRules', 'read')
  findRules(@Query() query: QueryRulesDto) {
    return this.config.findRules(query);
  }

  @Post('salary-rules')
  @RequirePermission('salaryRules', 'create')
  @ApiOperation({ summary: 'Create a rule; formulas are validated before storage' })
  createRule(@Body() dto: UpsertRuleDto) {
    return this.config.createRule(dto);
  }

  @Patch('salary-rules/:id')
  @RequirePermission('salaryRules', 'update')
  updateRule(@Param('id', ParseEntityIdPipe) id: string, @Body() dto: UpsertRuleDto) {
    return this.config.updateRule(id, dto);
  }

  @Delete('salary-rules/:id')
  @RequirePermission('salaryRules', 'delete')
  removeRule(@Param('id', ParseEntityIdPipe) id: string) {
    return this.config.removeRule(id);
  }

  @Get('email-logs')
  @RequirePermission('payslips', 'read')
  @ApiOperation({ summary: 'Payslip delivery outbox' })
  findEmailLogs() {
    return this.mail.findLogs();
  }
}
