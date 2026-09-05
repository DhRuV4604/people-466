import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Translates thrown errors into a consistent JSON body.
 *
 * Prisma errors are mapped to meaningful HTTP codes so a duplicate email returns
 * 409 rather than a generic 500, and unexpected errors never leak internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;
    // Set for faults that are the server's problem even when the shaped status
    // is a 4xx, so the cause still reaches the logs.
    let logAsFault = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const shaped = body as { message?: string | string[]; error?: string };
        message = shaped.message ?? exception.message;
        error = shaped.error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[] | undefined)?.join(', ');
          message = target
            ? `A record with this ${target} already exists.`
            : 'A record with these details already exists.';
          break;
        }
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Referenced record does not exist.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found.';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Database request could not be completed (${exception.code}).`;
          // An unmapped Prisma code is a bug here, not bad client input.
          logAsFault = true;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data supplied.';
      logAsFault = true;
    }

    // Log the full error server-side; the client only sees the shaped message.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR || logAsFault) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(error ? { error } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
