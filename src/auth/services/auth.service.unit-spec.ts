import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let httpClient: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
    httpClient = { request: vi.fn() };
    service = new AuthService(jwtService as never, httpClient as never);
  });

  describe('validateJwtToken', () => {
    it('retorna o payload quando o token é válido', async () => {
      jwtService.verify.mockReturnValue({ sub: '1' });

      await expect(service.validateJwtToken('token')).resolves.toEqual({
        sub: '1',
      });
    });

    it('lança UnauthorizedException quando o verify falha', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(service.validateJwtToken('token')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });
  });

  describe('validateSessionToken', () => {
    it('mapeia os campos do usuário retornado', async () => {
      httpClient.request.mockResolvedValue({
        valid: true,
        user: {
          id: '1',
          email: 'a@b.com',
          first_name: 'Ana',
          last_name: 'Silva',
          role: 'admin',
          status: 'active',
        },
      });

      await expect(service.validateSessionToken('s')).resolves.toEqual({
        valid: true,
        user: {
          id: '1',
          email: 'a@b.com',
          firstName: 'Ana',
          lastName: 'Silva',
          role: 'admin',
          status: 'active',
        },
      });
    });

    it('retorna user null quando o downstream não traz usuário', async () => {
      httpClient.request.mockResolvedValue({ valid: false, user: null });

      await expect(service.validateSessionToken('s')).resolves.toEqual({
        valid: false,
        user: null,
      });
    });

    it('lança UnauthorizedException quando o downstream falha', async () => {
      httpClient.request.mockRejectedValue(new Error('down'));

      await expect(service.validateSessionToken('s')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });
  });

  describe('login', () => {
    it('retorna o access_token do downstream', async () => {
      httpClient.request.mockResolvedValue({ access_token: 'jwt' });

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as never)
      ).resolves.toEqual({ access_token: 'jwt' });
    });

    it('lança UnauthorizedException quando o login falha', async () => {
      httpClient.request.mockRejectedValue(new Error('down'));

      await expect(
        service.login({ email: 'a@b.com', password: 'x' } as never)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('encaminha os campos e retorna o user_id', async () => {
      httpClient.request.mockResolvedValue({ user_id: '1' });

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'x',
          firstName: 'Ana',
          lastName: 'Silva',
        } as never)
      ).resolves.toEqual({ user_id: '1' });

      expect(httpClient.request).toHaveBeenCalledWith('users', {
        method: 'POST',
        path: '/auth/register',
        body: {
          email: 'a@b.com',
          password: 'x',
          first_name: 'Ana',
          last_name: 'Silva',
        },
      });
    });

    it('lança UnauthorizedException quando o registro falha', async () => {
      httpClient.request.mockRejectedValue(new Error('down'));

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'x',
          firstName: 'Ana',
          lastName: 'Silva',
        } as never)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
