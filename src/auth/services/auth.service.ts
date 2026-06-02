import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { GrpcClientFactory } from '@/grpc/factories/grpc.factory';
import type { UsersServiceClient } from '@/interfaces/gRpc/user-service';
import type { UserSession } from '@/interfaces/user-session';
import type { LoginDto } from '../dtos/login-dto';
import type { RegisterDto } from '../dtos/register-dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly gRpcFactory: GrpcClientFactory
  ) {}

  async validateJwtToken(token: string): Promise<unknown> {
    try {
      return this.jwtService.verify(token);
    } catch (_err) {
      throw new UnauthorizedException('Invalid JWT token');
    }
  }

  async validateSessionToken(sessionToken: string): Promise<UserSession> {
    try {
      const usersService = this.gRpcFactory.getService<
        UsersServiceClient,
        'users'
      >('users', 'UsersService');

      const { valid, user } = await firstValueFrom(
        usersService.validateSession({ token: sessionToken })
      );

      return {
        valid,
        user: user
          ? {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              status: user.status,
            }
          : null,
      };
    } catch (_err) {
      throw new UnauthorizedException('Invalid session token');
    }
  }
  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    try {
      const userService = this.gRpcFactory.getService<
        UsersServiceClient,
        'users'
      >('users', 'UsersService');

      const result = await firstValueFrom(
        userService.login({
          email: loginDto.email,
          password: loginDto.password,
        })
      );

      return result;
    } catch (_err) {
      throw new UnauthorizedException('Invalid login credentials');
    }
  }
  async register(registerDto: RegisterDto): Promise<{ user_id: string }> {
    try {
      const userService = this.gRpcFactory.getService<
        UsersServiceClient,
        'users'
      >('users', 'UsersService');

      const result = await firstValueFrom(
        userService.register({
          email: registerDto.email,
          password: registerDto.password,
          first_name: registerDto.firstName,
          last_name: registerDto.lastName,
        })
      );

      return result;
    } catch (_err) {
      throw new UnauthorizedException('Registration failed');
    }
  }
}
