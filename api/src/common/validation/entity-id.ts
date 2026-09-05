import { BadRequestException, PipeTransform, Injectable } from '@nestjs/common';
import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

/**
 * Primary keys in this schema are UUIDv7 (`@default(uuid(7))` in schema.prisma).
 * The unconstrained id-bearing columns that carry no foreign key -
 * `AuditLog.entityId`, `Attendance.editedById`, the `approvedBy`/`refusedBy`/
 * `paidBy` audit fields - stay plain text and are not guaranteed to be UUIDs,
 * so `IsUUID`/`ParseUUIDPipe` are still the wrong tool for the shared case.
 *
 * The pattern is deliberately loose: it rejects empty strings and obvious
 * junk without hard-coding a cuid version, so switching id strategy later does
 * not mean editing every DTO again.
 */
const ENTITY_ID = /^[A-Za-z0-9_-]{16,64}$/;

const MESSAGE = 'must be a valid record id';

/** Validates an id carried in a request body or query string. Pass
 *  `{ each: true }` for an array of ids. */
export function IsEntityId(options?: { each?: boolean }): PropertyDecorator {
  return applyDecorators(
    IsString(options),
    Matches(ENTITY_ID, { ...options, message: `$property ${MESSAGE}` })
  );
}

/** Validates an id carried in a route parameter. */
@Injectable()
export class ParseEntityIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !ENTITY_ID.test(value)) {
      throw new BadRequestException(`Route parameter ${MESSAGE}.`);
    }
    return value;
  }
}
