import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EnvModule } from '@/env/env.module';
import { EnvService } from '@/env/env.service';
import { GrpcModule } from '@/grpc/grpc.module';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PassportModule,
    GrpcModule,
    JwtModule.registerAsync({
      imports: [EnvModule],
      useFactory: (envService: EnvService) => ({
        secret: envService.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [EnvService],
    }),
  ],
  providers: [AuthService],
})
export class AuthModule {}
