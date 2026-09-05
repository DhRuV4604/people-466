import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SalaryStructureDto, SalaryRuleDto } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toNumber, toNumberOrNull, toDecimal } from '../../common/decimal';
import { PayrollEngineService } from './payroll-engine.service';
import {
  UpsertStructureDto,
  UpsertRuleDto,
  QueryRulesDto,
} from './dto/payroll.dto';

@Injectable()
export class SalaryConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PayrollEngineService
  ) {}

  private ruleToDto(r: Prisma.SalaryRuleGetPayload<object>): SalaryRuleDto {
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      structureId: r.structureId,
      category: r.category,
      sequence: r.sequence,
      computeType: r.computeType,
      amountFixed: toNumberOrNull(r.amountFixed),
      amountPercentage: toNumberOrNull(r.amountPercentage),
      percentageBase: r.percentageBase,
      formula: r.formula,
      condition: r.condition,
      appearsOnPayslip: r.appearsOnPayslip,
      active: r.active,
      note: r.note,
    };
  }

  // ---------------------------------------------------------------- Structures

  async findStructures(): Promise<SalaryStructureDto[]> {
    const structures = await this.prisma.salaryStructure.findMany({
      include: { _count: { select: { rules: true, contracts: true, payslips: true } } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return structures.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      active: s.active,
      counts: {
        rules: s._count.rules,
        contracts: s._count.contracts,
        payslips: s._count.payslips,
      },
    }));
  }

  async findStructure(id: string): Promise<SalaryStructureDto> {
    const structure = await this.prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        rules: { orderBy: { sequence: 'asc' } },
        _count: { select: { rules: true, contracts: true, payslips: true } },
      },
    });
    if (!structure) throw new NotFoundException('Salary structure not found.');

    return {
      id: structure.id,
      name: structure.name,
      code: structure.code,
      description: structure.description,
      active: structure.active,
      rules: structure.rules.map((r) => this.ruleToDto(r)),
      counts: {
        rules: structure._count.rules,
        contracts: structure._count.contracts,
        payslips: structure._count.payslips,
      },
    };
  }

  async createStructure(dto: UpsertStructureDto): Promise<SalaryStructureDto> {
    const created = await this.prisma.salaryStructure.create({
      data: { ...dto, code: dto.code.toUpperCase() },
    });
    return this.findStructure(created.id);
  }

  async updateStructure(id: string, dto: UpsertStructureDto): Promise<SalaryStructureDto> {
    await this.prisma.salaryStructure.update({
      where: { id },
      data: { ...dto, code: dto.code.toUpperCase() },
    });
    return this.findStructure(id);
  }

  async removeStructure(id: string): Promise<{ deleted: boolean; archived: boolean }> {
    const used = await this.prisma.payslip.count({ where: { structureId: id } });

    // Structures referenced by payslips are archived to preserve history.
    if (used > 0) {
      await this.prisma.salaryStructure.update({ where: { id }, data: { active: false } });
      return { deleted: false, archived: true };
    }
    await this.prisma.salaryStructure.delete({ where: { id } });
    return { deleted: true, archived: false };
  }

  // ---------------------------------------------------------------- Rules

  async findRules(query: QueryRulesDto): Promise<SalaryRuleDto[]> {
    const rules = await this.prisma.salaryRule.findMany({
      where: {
        ...(query.structureId ? { structureId: query.structureId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' as const } },
                { code: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { structure: { select: { id: true, name: true } } },
      orderBy: [{ structure: { name: 'asc' } }, { sequence: 'asc' }],
    });

    return rules.map((r) => ({ ...this.ruleToDto(r), structure: r.structure }));
  }

  /** Reject an invalid formula before it is stored so a bad rule cannot break a pay run. */
  private assertExpressionsValid(dto: UpsertRuleDto): void {
    if (dto.computeType === 'FORMULA') {
      if (!dto.formula) {
        throw new BadRequestException('A formula is required for formula-based rules.');
      }
      const error = this.engine.validateExpression(dto.formula);
      if (error) throw new BadRequestException(`Formula error — ${error}`);
    }

    if (dto.computeType === 'PERCENTAGE' && dto.amountPercentage === undefined) {
      throw new BadRequestException('A percentage value is required for percentage-based rules.');
    }

    if (dto.condition) {
      const error = this.engine.validateExpression(dto.condition);
      if (error) throw new BadRequestException(`Condition error — ${error}`);
    }
  }

  private ruleData(dto: UpsertRuleDto) {
    return {
      name: dto.name,
      code: dto.code.toUpperCase().replace(/\s+/g, '_'),
      structureId: dto.structureId,
      category: dto.category,
      sequence: dto.sequence ?? 100,
      computeType: dto.computeType ?? 'FIXED',
      // Only the field matching the compute type is stored; the rest are cleared
      // so a rule switched from FIXED to FORMULA cannot keep a stale amount.
      amountFixed:
        dto.computeType === 'FIXED' && dto.amountFixed !== undefined
          ? toDecimal(dto.amountFixed)
          : null,
      amountPercentage:
        dto.computeType === 'PERCENTAGE' && dto.amountPercentage !== undefined
          ? new Prisma.Decimal(dto.amountPercentage.toFixed(4))
          : null,
      percentageBase: dto.computeType === 'PERCENTAGE' ? (dto.percentageBase ?? 'BASIC') : null,
      formula: dto.computeType === 'FORMULA' ? (dto.formula ?? null) : null,
      condition: dto.condition ?? null,
      appearsOnPayslip: dto.appearsOnPayslip ?? true,
      active: dto.active ?? true,
      note: dto.note ?? null,
    };
  }

  async createRule(dto: UpsertRuleDto): Promise<SalaryRuleDto> {
    this.assertExpressionsValid(dto);
    const created = await this.prisma.salaryRule.create({ data: this.ruleData(dto) });
    return this.ruleToDto(created);
  }

  async updateRule(id: string, dto: UpsertRuleDto): Promise<SalaryRuleDto> {
    this.assertExpressionsValid(dto);
    const updated = await this.prisma.salaryRule.update({
      where: { id },
      data: this.ruleData(dto),
    });
    return this.ruleToDto(updated);
  }

  async removeRule(id: string): Promise<{ deleted: boolean; archived: boolean }> {
    const used = await this.prisma.payslipLine.count({ where: { ruleId: id } });

    // Deactivate rather than delete while payslip lines still reference the rule.
    if (used > 0) {
      await this.prisma.salaryRule.update({ where: { id }, data: { active: false } });
      return { deleted: false, archived: true };
    }
    await this.prisma.salaryRule.delete({ where: { id } });
    return { deleted: true, archived: false };
  }
}
