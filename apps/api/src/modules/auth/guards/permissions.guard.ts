import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can } from '@peoplepay360/shared';
import { PERMISSION_KEY, type RequiredPermission } from '../../../common/decorators';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Enforces the shared RBAC matrix for routes annotated with @RequirePermission.
 *
 * This is the authority: the web client hides controls the user lacks, but that
 * is presentation only - a forged request still fails here.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Routes without the decorator only need authentication.
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Not authenticated.');

    if (!can(user.role, required.module, required.action)) {
      throw new ForbiddenException(
        `Your role (${user.role}) cannot ${required.action} ${required.module}.`
      );
    }
    return true;
  }
}
