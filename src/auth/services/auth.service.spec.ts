import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRequestError } from '@/http/services/http-client.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let httpClient: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
    httpClient = { request: vi.fn() };
    service = new AuthService(jwtService as never, httpClient as never);
    vi.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    vi.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  describe('validateJwtToken', () => {
    it('returns the payload when the token is valid', async () => {
      jwtService.verify.mockReturnValue({ sub: '1' });

      await expect(service.validateJwtToken('token')).resolves.toEqual({
        sub: '1',
      });
    });

    it('throws UnauthorizedException when verify fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(service.validateJwtToken('token')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });
  });

  describe('validateSessionToken', () => {
    it('maps the fields of the returned user', async () => {
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

    it('returns a null user when the downstream carries none', async () => {
      httpClient.request.mockResolvedValue({ valid: false, user: null });

      await expect(service.validateSessionToken('s')).resolves.toEqual({
        valid: false,
        user: null,
      });
    });

    it('throws ServiceUnavailableException when the downstream is unreachable', async () => {
      httpClient.request.mockRejectedValue(new Error('down'));

      await expect(service.validateSessionToken('s')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('throws UnauthorizedException when the downstream rejects the session', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(401, 'nope'));

      await expect(service.validateSessionToken('s')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });
  });

  describe('login', () => {
    const credentials = { email: 'a@b.com', password: 'x' } as never;

    it('returns the access_token from the downstream', async () => {
      httpClient.request.mockResolvedValue({ access_token: 'jwt' });

      await expect(service.login(credentials)).resolves.toEqual({
        access_token: 'jwt',
      });
    });

    it('throws UnauthorizedException when the credentials are rejected', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(401, 'nope'));

      await expect(service.login(credentials)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    // An outage must not surface as a 401: that would tell the user their
    // password is wrong and hide the incident from anything alerting on 5xx.
    it('throws ServiceUnavailableException when the users service is down', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(503, 'down'));

      await expect(service.login(credentials)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('throws ServiceUnavailableException when the call never leaves', async () => {
      httpClient.request.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.login(credentials)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    // A 404 must be indistinguishable from a 401, otherwise an anonymous
    // caller can enumerate registered emails.
    it('treats a 404 as UnauthorizedException', async () => {
      httpClient.request.mockRejectedValue(
        new HttpRequestError(404, 'not found')
      );

      await expect(service.login(credentials)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });
  });

  describe('register', () => {
    const payload = {
      email: 'a@b.com',
      password: 'x',
      firstName: 'Ana',
      lastName: 'Silva',
    } as never;

    it('forwards the fields and returns the user_id', async () => {
      httpClient.request.mockResolvedValue({ user_id: '1' });

      await expect(service.register(payload)).resolves.toEqual({
        user_id: '1',
      });

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

    it('throws ConflictException when the email already exists', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(409, 'taken'));

      await expect(service.register(payload)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it('throws BadRequestException when the payload is rejected', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(400, 'bad'));

      await expect(service.register(payload)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('throws ServiceUnavailableException when the downstream fails', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(500, 'boom'));

      await expect(service.register(payload)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    // The downstream message may carry internal detail and is never forwarded.
    it('does not leak the downstream message', async () => {
      httpClient.request.mockRejectedValue(
        new HttpRequestError(500, 'psql: relation "users" does not exist')
      );

      await expect(service.register(payload)).rejects.toThrow(
        'Authentication service is unavailable'
      );
    });
  });
});
