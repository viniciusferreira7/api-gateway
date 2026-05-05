import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { envSchema } from './env/env';
import { EnvModule } from './env/env.module';
import { EnvService } from './env/env.service';
import { GatewayModule } from './gateway/gateway.module';
import { GrpcModule } from './grpc/grpc.module';
import { LoggingMiddleware } from './middleware/logging/logging.middleware';
import { MiddlewareModule } from './middleware/middleware.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
      validate: (env) => {
        return envSchema.parse(env);
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [EnvService],
      useFactory: (envService: EnvService) => [
        {
          name: 'short',
          ttl: Number(envService.get('RATE_TTL_SHORT') ?? 1_000),
          limit: Number(envService.get('RATE_LIMIT_SHORT') ?? 10),
        },
        {
          name: 'medium',
          ttl: Number(envService.get('RATE_TTL_MEDIUM') ?? 60_000),
          limit: Number(envService.get('RATE_LIMIT_MEDIUM') ?? 100),
        },
        {
          name: 'long',
          ttl: Number(envService.get('RATE_TTL_LONG') ?? 900_000),
          limit: Number(envService.get('RATE_LIMIT_LONG') ?? 1_000),
        },
      ],
      inject: [EnvService],
    }),
    EnvModule,
    ProxyModule,
    ConfigModule,
    GatewayModule,
    GrpcModule,
    MiddlewareModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
