import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpClientService } from '@/http/services/http-client.service';
import type {
  UserSession,
  ValidateSessionResponse,
} from '@/interfaces/user-session';
import type { LoginDto } from '../dtos/login-dto';
import type { RegisterDto } from '../dtos/register-dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpClient: HttpClientService
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
      const { valid, user } =
        await this.httpClient.request<ValidateSessionResponse>('users', {
          method: 'POST',
          path: '/auth/sessions/validate',
          body: { token: sessionToken },
        });

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
      return await this.httpClient.request<{ access_token: string }>('users', {
        method: 'POST',
        path: '/auth/login',
        body: {
          email: loginDto.email,
          password: loginDto.password,
        },
      });
    } catch (_err) {
      throw new UnauthorizedException('Invalid login credentials');
    }
  }

  async register(registerDto: RegisterDto): Promise<{ user_id: string }> {
    try {
      return await this.httpClient.request<{ user_id: string }>('users', {
        method: 'POST',
        path: '/auth/register',
        body: {
          email: registerDto.email,
          password: registerDto.password,
          first_name: registerDto.firstName,
          last_name: registerDto.lastName,
        },
      });
    } catch (_err) {
      throw new UnauthorizedException('Registration failed');
    }
  }
}
