import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { LoginResponse, Role } from '@peoplepay360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedUser } from './auth.types';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  static hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { employee: { select: { id: true } } },
    });

    // The same message covers unknown email, wrong password and deactivated
    // account so the endpoint cannot be used to enumerate valid addresses.
    const invalid = new UnauthorizedException('Invalid email or password.');

    if (!user || !user.active) throw invalid;
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) throw invalid;

    const employeeId = user.employee?.id ?? null;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      employeeId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as Role,
        employeeId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Replaces the password on the signed-in account.
   *
   * The current one is checked even though the caller is already
   * authenticated: a token left open on an unattended machine should not be
   * enough to lock the owner out of their own account.
   */
  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto
  ): Promise<{ changed: true }> {
    const current = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!current || !current.active) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
      throw new BadRequestException('That is not your current password.');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Choose a password you have not just used.');
    }

    await this.prisma.user.update({
      where: { id: current.id },
      data: {
        passwordHash: await AuthService.hashPassword(dto.newPassword),
        mustChangePassword: false,
      },
    });

    return { changed: true };
  }

  /** Re-reads the account so the caller always sees current role and linkage. */
  async me(user: AuthenticatedUser): Promise<LoginResponse['user']> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { employee: { select: { id: true } } },
    });

    if (!current || !current.active) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    return {
      id: current.id,
      email: current.email,
      name: current.name,
      role: current.role as Role,
      employeeId: current.employee?.id ?? null,
      mustChangePassword: current.mustChangePassword,
    };
  }
}
