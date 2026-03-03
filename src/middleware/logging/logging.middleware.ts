import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-agent') || '';
    const startTime = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${originalUrl} - IP: ${ip} - User agent: ${userAgent}`
    );

    res.on('finish', () => {
      const statusCode = res.statusCode;
      const contentLength = res.get('Content-Length');
      const duration = Date.now() - startTime;

      this.logger.log(
        `Outgoing Response: ${method} ${originalUrl} - ${statusCode} - ${contentLength ?? 0} - ${duration}ms`
      );

      if (statusCode >= 400) {
        this.logger.error(
          `Error response: ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
        );
      }
    });

    res.on('error', (error) => {
      this.logger.error(
        `Response Error: ${method} ${originalUrl} - ${error.message}`
      );
    });

    req.on('timeout', () => {
      this.logger.warn(
        `Request Timeout: ${method} ${originalUrl} - ${Date.now() - startTime}ms`
      );
    });

    next();
  }
}
