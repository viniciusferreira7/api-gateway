import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { GrpcClientFactory } from '@/grpc/grpc.factory';
import type { UsersServiceClient } from '@/interfaces/gRpc/user-service';
import type { UserSession } from '@/interfaces/user-session';

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
      const usersService = this.gRpcFactory.getService<UsersServiceClient>(
        'users',
        'UsersService'
      );

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
  async login() {}
  async register() {}
}
