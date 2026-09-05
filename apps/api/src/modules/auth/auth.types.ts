import type { Role } from '@peoplepay360/shared';

/** Shape attached to `request.user` after a bearer token is validated. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Null when the account is not linked to an employee record. */
  employeeId: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
}
