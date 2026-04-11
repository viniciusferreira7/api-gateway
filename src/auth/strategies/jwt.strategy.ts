import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import z from 'zod';
import type { EnvService } from '@/env/env.service';
import { AuthService } from '../services/auth.service';

const tokenPayloadSchema = z.object({
  token: z.string(),
  sub: z.uuid(),
  email: z.email(),
  role: z.string(),
});

export type UserPayload = z.infer<typeof tokenPayloadSchema>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Cannot use "this" before calling super
    private readonly env: EnvService
  ) {
    const jwtSecret = env.get('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: UserPayload) {
    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.authService.validateJwtToken(payload.token);

    if (!user) {
      throw new UnauthorizedException();
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
