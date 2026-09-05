import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedUser } from './auth.types';
import type { Role } from '@peoplepay360/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  /**
   * The token is re-checked against the database on every request so that a
   * deactivated account, a changed role, or a re-linked employee takes effect
   * immediately rather than when the token happens to expire.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // A signed token whose subject is not a well-formed id is still a token
    // nobody can be behind. Left to Prisma it raises P2023 and leaves the
    // client a 400 to puzzle over, when what it needs to hear is "sign in
    // again" — which is what a session issued before the ids changed shape is
    // actually being told.
    const user = await this.prisma.user
      .findUnique({
        where: { id: payload.sub },
        include: { employee: { select: { id: true } } },
      })
      .catch(() => null);

    if (!user || !user.active) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      employeeId: user.employee?.id ?? null,
    };
  }
}
