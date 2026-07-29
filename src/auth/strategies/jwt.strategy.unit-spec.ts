import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtStrategy, type UserPayload } from './jwt.strategy';

const payload: UserPayload = {
  token: 'inner-token',
  sub: '11111111-1111-1111-1111-111111111111',
  email: 'a@b.com',
  role: 'admin',
  iat: 1,
  exp: 2,
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: { validateJwtToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { validateJwtToken: vi.fn() };
    const env = { get: vi.fn().mockReturnValue('secret') };
    strategy = new JwtStrategy(authService as never, env as never);
  });

  it('lança Unauthorized quando o payload é vazio', async () => {
    await expect(strategy.validate(undefined as never)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('lança Unauthorized quando o token interno não valida', async () => {
    authService.validateJwtToken.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('retorna a identidade a partir do payload quando válido', async () => {
    authService.validateJwtToken.mockResolvedValue({ ok: true });

    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    expect(authService.validateJwtToken).toHaveBeenCalledWith(payload.token);
  });
});
