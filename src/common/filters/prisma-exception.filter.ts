import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

// Turns raw DB errors into clean HTTP answers (never leaks SQL or stack traces)
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Resource already exists'],
      P2025: [HttpStatus.NOT_FOUND, 'Resource not found'],
      P2003: [HttpStatus.BAD_REQUEST, 'Related resource does not exist'],
    };
    const [statusCode, message] = map[exception.code] ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Database error',
    ];
    res.status(statusCode).json({ statusCode, message });
  }
}
