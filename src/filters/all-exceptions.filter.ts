import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpRequestError } from '@/http/services/http-client.service';

type ErrorBody = {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
};

/**
 * Single exit point for every error leaving the gateway.
 *
 * Without it each failure mode renders differently: Nest's default filter emits
 * one shape, an unhandled rejection another, and a raw `HttpRequestError` from
 * the HTTP client escapes as a 500 carrying `Downstream request failed with
 * status 503` — an internal message describing another service, which is
 * exactly what must not reach a client.
 *
 * Two rules hold regardless of where the error came from:
 *
 * - The body shape is always the same, so clients parse one contract.
 * - Nothing above 500 explains itself. Server-side causes are logged, never
 *   serialised; the Nest logger is backed by the signals adapter, so those
 *   records carry the request's trace_id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message } = AllExceptionsFilter.resolve(exception);

    const description =
      exception instanceof Error ? exception.message : String(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}: ${description}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${status}: ${description}`
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      message,
    };

    response.status(status).json(body);
  }

  private static resolve(exception: unknown): {
    status: number;
    message: string | string[];
  } {
    // Raised by HttpClientService when a downstream service answers non-2xx.
    // The status is worth preserving — a 503 upstream is a 503 here, not a 500
    // — but the message names another service and is dropped.
    if (exception instanceof HttpRequestError) {
      return {
        status:
          exception.status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? HttpStatus.BAD_GATEWAY
            : exception.status,
        message: 'Upstream service request failed',
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      // A 5xx never explains itself with its own message: that text may have
      // been built from an internal error. The canonical status phrase is
      // returned instead — generic, but still telling the client whether to
      // retry (503) or stop (500).
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        return { status, message: AllExceptionsFilter.serverErrorText(status) };
      }

      const payload = exception.getResponse();

      // ValidationPipe returns `{ message: string[], error, statusCode }`;
      // the array is the useful part and is safe, being derived from the
      // caller's own payload.
      if (typeof payload === 'object' && payload !== null) {
        const { message } = payload as { message?: unknown };

        if (typeof message === 'string' || Array.isArray(message)) {
          return { status, message: message as string | string[] };
        }
      }

      return {
        status,
        message: typeof payload === 'string' ? payload : exception.message,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private static serverErrorText(status: number): string {
    switch (status) {
      case HttpStatus.BAD_GATEWAY:
        return 'Bad gateway';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service unavailable';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'Gateway timeout';
      default:
        return 'Internal server error';
    }
  }
}
