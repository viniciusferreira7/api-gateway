import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggingMiddleware } from './logging/logging.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 100, // 100 requests
      },
    ]),
  ],
  providers: [LoggingMiddleware],
})
export class MiddlewareModule {}
