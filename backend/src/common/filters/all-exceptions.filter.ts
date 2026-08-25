import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as any;
        message = Array.isArray(r.message) ? r.message[0] : r.message || message;
        errors = Array.isArray(r.message) ? r.message : undefined;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      // Prisma known errors -> friendlier statuses
      if (exception.name === 'PrismaClientKnownRequestError') {
        const e = exception as any;
        if (e.code === 'P2002') {
          status = HttpStatus.CONFLICT;
          message = 'Duplicate value violates a unique constraint';
        } else if (e.code === 'P2025') {
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
        } else {
          status = HttpStatus.BAD_REQUEST;
        }
      } else if (
        exception.name === 'PrismaClientValidationError' ||
        exception.name === 'PrismaClientUnknownRequestError'
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid data provided';
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
