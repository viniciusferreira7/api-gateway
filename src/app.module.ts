import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envSchema } from './env/env';
import { EnvModule } from './env/env.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
      validate: (env) => {
        return envSchema.parse(env);
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 request per minute
      },
    ]),
    EnvModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
