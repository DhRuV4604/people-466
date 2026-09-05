import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Module, Action } from '@peoplepay360/shared';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

/** Marks a route as reachable without a bearer token. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Declares the permission a route requires; enforced by PermissionsGuard. */
export const PERMISSION_KEY = 'requiredPermission';
export interface RequiredPermission {
  module: Module;
  action: Action;
}
export const RequirePermission = (module: Module, action: Action) =>
  SetMetadata(PERMISSION_KEY, { module, action } satisfies RequiredPermission);

/** Injects the authenticated user resolved by JwtStrategy. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return data ? request.user?.[data] : request.user;
  }
);
