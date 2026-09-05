import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { can, scopeToOwnRecords } from '@peoplepay360/shared';
import type {
  EmployeeSummaryDto,
  EmployeeDetailDto,
  EmployeeOptionDto,
  Paginated,
} from '@peoplepay360/shared';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOneTimePassword } from '../../common/one-time-password';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../payroll/mail.service';
import { pageArgs, paginated } from '../../common/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import {
  StorageService,
  type UploadedFile as UploadedFileLike,
} from '../files/storage.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateEmployeeDto, UpdateEmployeeDto, QueryEmployeesDto } from './dto/employee.dto';
import { NO_MATCH_ID } from '../../common/scoping';

const SUMMARY_INCLUDE = {
  department: true,
  jobPosition: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  workingSchedule: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeSummaryRow = Prisma.EmployeeGetPayload<{ include: typeof SUMMARY_INCLUDE }>;

/** What a profile picture may be. Anything else is a file, not a face. */
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly storage: StorageService
  ) {}

  private toSummary(e: EmployeeSummaryRow): EmployeeSummaryDto {
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      fullName: `${e.firstName} ${e.lastName}`,
      workEmail: e.workEmail,
      employeeType: e.employeeType,
      status: e.status,
      avatarFileId: e.avatarId,
      department: e.department ? { id: e.department.id, name: e.department.name } : null,
      jobPosition: e.jobPosition ? { id: e.jobPosition.id, name: e.jobPosition.name } : null,
      manager: e.manager
        ? { id: e.manager.id, fullName: `${e.manager.firstName} ${e.manager.lastName}` }
        : null,
      workingSchedule: e.workingSchedule
        ? { id: e.workingSchedule.id, name: e.workingSchedule.name }
        : null,
      // Bank details are reduced to a boolean here; the raw account number is
      // only exposed on the detail endpoint.
      hasBankDetails: Boolean(e.bankName && e.bankAccountNumber),
      hireDate: e.hireDate.toISOString(),
    };
  }

  async findAll(
    query: QueryEmployeesDto,
    user: AuthenticatedUser
  ): Promise<Paginated<EmployeeSummaryDto>> {
    // An employee may only ever see their own record.
    const scoped = user.role === 'EMPLOYEE' ? { id: user.employeeId ?? NO_MATCH_ID } : {};

    const where: Prisma.EmployeeWhereInput = {
      ...scoped,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.employeeType ? { employeeType: query.employeeType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.missingBank
        ? { OR: [{ bankAccountNumber: null }, { bankName: null }] }
        : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' as const } },
              { lastName: { contains: query.q, mode: 'insensitive' as const } },
              { workEmail: { contains: query.q, mode: 'insensitive' as const } },
              { employeeCode: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const { skip, take, page, pageSize } = pageArgs(query);

    // One round trip: the rows and the count of everything matching the filter,
    // which is what the page numbers are derived from.
    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
        skip,
        take,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return paginated(
      employees.map((e) => this.toSummary(e)),
      total,
      page,
      pageSize
    );
  }

  /**
   * The id/label pairs forms need to point a record at an employee.
   *
   * Deliberately not `findAll`: a dropdown needs four columns, not every column
   * of every row plus its department, position, manager and schedule. The same
   * own-records scoping applies, so an Employee still only ever sees itself.
   */
  async findOptions(user: AuthenticatedUser): Promise<EmployeeOptionDto[]> {
    const scoped = user.role === 'EMPLOYEE' ? { id: user.employeeId ?? NO_MATCH_ID } : {};

    const employees = await this.prisma.employee.findMany({
      where: scoped,
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return employees.map((e) => ({
      id: e.id,
      fullName: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
    }));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    if (user.role === 'EMPLOYEE' && user.employeeId !== id) {
      throw new NotFoundException('Employee not found.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...SUMMARY_INCLUDE,
        _count: {
          select: {
            contracts: true,
            attendances: true,
            leaveRequests: true,
            leaveAllocations: true,
            payslips: true,
            documents: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');

    return {
      ...this.toSummary(employee),
      workPhone: employee.workPhone,
      dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
      gender: employee.gender,
      address: employee.address,
      bankName: employee.bankName,
      bankAccountNumber: employee.bankAccountNumber,
      exitDate: employee.exitDate?.toISOString() ?? null,
      departmentId: employee.departmentId,
      jobPositionId: employee.jobPositionId,
      managerId: employee.managerId,
      workingScheduleId: employee.workingScheduleId,
      counts: {
        contracts: employee._count.contracts,
        attendances: employee._count.attendances,
        leaveRequests: employee._count.leaveRequests,
        leaveAllocations: employee._count.leaveAllocations,
        payslips: employee._count.payslips,
        documents: employee._count.documents,
      },
    };
  }

  private async nextEmployeeCode(): Promise<string> {
    const last = await this.prisma.employee.findFirst({
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });
    const n = last ? parseInt(last.employeeCode.replace(/\D/g, ''), 10) + 1 : 1;
    return `EMP${String(n).padStart(4, '0')}`;
  }

  /**
   * Creates the person: their employee record and the sign-in that goes with
   * it, in one transaction, followed by an emailed invite.
   *
   * There is no such thing here as an employee who cannot sign in, so the two
   * are never created separately and never linked afterwards. The password is
   * issued rather than chosen — nobody should be inventing a colleague's
   * password — and works exactly once.
   *
   * The invite is sent after the transaction commits. A bounced invite leaves
   * a real employee whose password can be reissued, which is a far smaller
   * problem than a create rolled back because a mail server was down.
   */
  async create(dto: CreateEmployeeDto, user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    const email = dto.workEmail.toLowerCase();

    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new BadRequestException('That work email already has an account.');
    }

    const password = generateOneTimePassword();

    const passwordHash = await AuthService.hashPassword(password);
    const employeeCode = await this.nextEmployeeCode();

    // One transaction: an employee without its sign-in, or a sign-in with
    // nobody behind it, are both states the rest of the app now assumes cannot
    // happen. Prisma will not take a nested create alongside the scalar
    // foreign keys this record carries, so the account is written first and
    // its id passed in.
    const created = await this.prisma.$transaction(async (tx) => {
      const account = await tx.user.create({
        data: {
          email,
          name: `${dto.firstName} ${dto.lastName}`,
          role: dto.role ?? 'EMPLOYEE',
          active: true,
          passwordHash,
          mustChangePassword: true,
        },
      });

      return tx.employee.create({
      data: {
        userId: account.id,
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        workEmail: dto.workEmail.toLowerCase(),
        workPhone: dto.workPhone ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        address: dto.address ?? null,
        bankName: dto.bankName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        employeeType: dto.employeeType ?? 'FULL_TIME',
        status: dto.status ?? 'ACTIVE',
        hireDate: new Date(dto.hireDate),
        departmentId: dto.departmentId ?? null,
        jobPositionId: dto.jobPositionId ?? null,
        managerId: dto.managerId ?? null,
        workingScheduleId: dto.workingScheduleId ?? null,
      },
      });
    });

    // Everyone gets an account and an invite. A person on the payroll who
    // cannot sign in is a support ticket waiting to happen, and the toggle
    // that used to allow it only ever produced one by accident.
    let invite: EmployeeDetailDto['invite'];
    {
      const result = await this.mail.sendInvite({
        to: email,
        name: `${dto.firstName} ${dto.lastName}`,
        password,
        signInUrl: this.config.get<string>('signInUrl') ?? 'http://localhost:3000/login',
      });
      if (result.delivered) {
        await this.prisma.user.update({
          where: { id: created.userId },
          data: { invitedAt: new Date() },
        });
        invite = { delivered: true };
      } else {
        // Handed back exactly once, to the person who just created the record.
        // The alternative is an account with a password nobody holds.
        invite = { delivered: false, error: result.error, oneTimePassword: password };
      }
    }

    await this.giveStarterAvatar(created.id, user.userId);

    // Every role that can read an employee is told, except the Employee role:
    // it only ever sees itself, so a new colleague is not its news.
    await this.notifications.notifyPermission(
      'employees',
      'read',
      {
        type: 'employee.created',
        title: `${created.firstName} ${created.lastName} joined`,
        body: `Employee ${created.employeeCode} was added.`,
        href: `/employees/${created.id}`,
        actorName: user.name,
        actorId: user.userId,
      },
      (role) => !scopeToOwnRecords(role)
    );

    return { ...(await this.findOne(created.id, user)), invite };
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthenticatedUser
  ): Promise<EmployeeDetailDto> {
    // A self-referencing manager would create a cycle in the reporting tree.
    if (dto.managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager.');
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.workEmail !== undefined ? { workEmail: dto.workEmail.toLowerCase() } : {}),
        ...(dto.workPhone !== undefined ? { workPhone: dto.workPhone } : {}),
        ...(dto.dateOfBirth !== undefined
          ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }
          : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
        ...(dto.bankAccountNumber !== undefined
          ? { bankAccountNumber: dto.bankAccountNumber }
          : {}),
        ...(dto.employeeType !== undefined ? { employeeType: dto.employeeType } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.hireDate !== undefined ? { hireDate: new Date(dto.hireDate) } : {}),
        ...(dto.exitDate !== undefined
          ? { exitDate: dto.exitDate ? new Date(dto.exitDate) : null }
          : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.jobPositionId !== undefined ? { jobPositionId: dto.jobPositionId } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
        ...(dto.workingScheduleId !== undefined
          ? { workingScheduleId: dto.workingScheduleId }
          : {}),
      },
    });

    // The account carries the same name, address and reach, so anything that
    // moved has to move on both. Renaming an employee and leaving their
    // sign-in under the old name is how the two drift apart.
    const account: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const after = await this.prisma.employee.findUniqueOrThrow({
        where: { id },
        select: { firstName: true, lastName: true },
      });
      account.name = `${after.firstName} ${after.lastName}`;
    }
    if (dto.workEmail !== undefined) account.email = dto.workEmail.toLowerCase();
    if (dto.role !== undefined) account.role = dto.role;

    if (Object.keys(account).length > 0) {
      const { userId } = await this.prisma.employee.findUniqueOrThrow({
        where: { id },
        select: { userId: true },
      });
      await this.prisma.user.update({ where: { id: userId }, data: account });
    }

    return this.findOne(id, user);
  }

  /**
   * Reissues a one-time password and emails it again, for someone who never
   * got the first invite or has locked themselves out.
   */
  /**
   * Refused on your own record.
   *
   * A reinvite replaces the password on the account, so aimed at yourself it
   * ends the session running it and locks you out until the mail arrives —
   * and on an install with no mail configured, until someone else intervenes.
   * Changing your own password is what `/auth/change-password` is for.
   */
  /**
   * Gives a new employee a starter picture.
   *
   * Seeded with a random id rather than their name or email: the request goes
   * to a third party, and there is no reason for it to carry anything about
   * the person. The seed is not stored either — this runs once, and the
   * picture that comes back is the artefact.
   *
   * Failure is swallowed. An employee whose account exists but whose avatar
   * did not download is a smaller problem than a create that half happened,
   * and the fallback is the initials they would have had anyway.
   */
  private async giveStarterAvatar(employeeId: string, userId: string): Promise<void> {
    const base = this.config.get<string>('avatar.apiUrl')?.trim();
    if (!base) return;

    const size = this.config.get<number>('avatar.size') ?? 256;
    const url = `${base}?seed=${randomUUID()}&size=${size}`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`upstream said ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const stored = await this.storage.saveGenerated(
        buffer,
        'avatar.png',
        'image/png',
        userId,
        'avatars'
      );
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { avatarId: stored.id },
      });
    } catch (error) {
      this.logger.warn(
        `Could not fetch a starter avatar: ${error instanceof Error ? error.message : 'unknown'}`
      );
    }
  }

  /**
   * Sets a profile picture.
   *
   * Anyone may set their own; changing someone else's needs the same grant as
   * editing them. The old file is left on disk: nothing else points at it, but
   * deleting bytes on a path this hot is how a missing avatar becomes a 500.
   */
  async setAvatar(
    id: string,
    file: UploadedFileLike | undefined,
    user: AuthenticatedUser
  ): Promise<{ avatarFileId: string }> {
    if (!file) throw new BadRequestException('Choose an image.');
    if (!AVATAR_TYPES.has(file.mimetype)) {
      throw new BadRequestException('A profile picture has to be a PNG, JPEG or WebP.');
    }
    if (user.employeeId !== id && !can(user.role, 'employees', 'update')) {
      throw new ForbiddenException('You can only change your own picture.');
    }

    const stored = await this.storage.save(file, user.userId, 'avatars');
    await this.prisma.employee.update({
      where: { id },
      data: { avatarId: stored.id },
    });
    return { avatarFileId: stored.id };
  }

  /** The avatar's file id, for whoever is allowed to see the employee. */
  async avatarFileId(id: string, user: AuthenticatedUser): Promise<string> {
    if (scopeToOwnRecords(user.role) && user.employeeId !== id) {
      throw new NotFoundException('Employee not found.');
    }
    const row = await this.prisma.employee.findUnique({
      where: { id },
      select: { avatarId: true },
    });
    if (!row?.avatarId) throw new NotFoundException('No picture has been set.');
    return row.avatarId;
  }

  async reinvite(
    id: string,
    user: AuthenticatedUser
  ): Promise<{ delivered: boolean; error?: string; oneTimePassword?: string }> {
    if (user.employeeId === id) {
      throw new BadRequestException(
        'You cannot send yourself an invite: it would replace the password you are signed in with. Change your own password from your profile instead.'
      );
    }

    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: { userId: true, firstName: true, lastName: true, workEmail: true },
    });

    const password = generateOneTimePassword();
    await this.prisma.user.update({
      where: { id: employee.userId },
      data: {
        passwordHash: await AuthService.hashPassword(password),
        mustChangePassword: true,
        active: true,
      },
    });

    const invite = await this.mail.sendInvite({
      to: employee.workEmail,
      name: `${employee.firstName} ${employee.lastName}`,
      password,
      signInUrl: this.config.get<string>('signInUrl') ?? 'http://localhost:3000/login',
    });

    if (invite.delivered) {
      await this.prisma.user.update({
        where: { id: employee.userId },
        data: { invitedAt: new Date() },
      });
      return invite;
    }

    // Same reasoning as create: the account is now on a password only this
    // response holds, so returning it is what keeps the person reachable.
    return { ...invite, oneTimePassword: password };
  }

  async remove(
    id: string,
    user: AuthenticatedUser
  ): Promise<{ deleted: boolean; archived: boolean }> {
    // Deleting yourself destroys the account holding the session doing it, and
    // on the last admin it locks everyone out of the panel for good.
    if (user.employeeId === id) {
      throw new BadRequestException(
        'You cannot delete your own record. Ask another administrator to do it.'
      );
    }

    const payslipCount = await this.prisma.payslip.count({ where: { employeeId: id } });

    // Payroll history must not be destroyed; archive the employee instead.
    // The sign-in goes with them either way: someone who has left should not
    // still be able to open the app, archived record or not.
    if (payslipCount > 0) {
      const archived = await this.prisma.employee.update({
        where: { id },
        data: { status: 'INACTIVE', exitDate: new Date() },
      });
      await this.prisma.user.update({
        where: { id: archived.userId },
        data: { active: false },
      });
      return { deleted: false, archived: true };
    }

    // Deleting the account takes the employee with it: the relation cascades,
    // so this is one delete rather than two that could half succeed.
    const { userId } = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: { userId: true },
    });
    await this.prisma.user.delete({ where: { id: userId } });
    return { deleted: true, archived: false };
  }
}
