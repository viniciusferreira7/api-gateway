import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRequestError } from '@/http/services/http-client.service';
import { metrics } from '@/observability/metrics';
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

  describe('validateToken', () => {
    it('asks the users service with the caller authorization header', async () => {
      const validated = { userId: '1', email: 'a@b.com', role: 'seller' };
      httpClient.request.mockResolvedValue(validated);

      await expect(service.validateToken('Bearer t')).resolves.toEqual(
        validated
      );
      expect(httpClient.request).toHaveBeenCalledWith('users', {
        method: 'GET',
        path: '/auth/validate-token',
        headers: { authorization: 'Bearer t' },
      });
    });

    it('throws UnauthorizedException when the users service refuses the token', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(401, 'nope'));

      await expect(service.validateToken('Bearer t')).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    // An outage is not a bad token: the client should retry, not log in again.
    it('throws ServiceUnavailableException when the users service is unreachable', async () => {
      httpClient.request.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.validateToken('Bearer t')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('throws ServiceUnavailableException when the users service fails', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(503, 'down'));

      await expect(service.validateToken('Bearer t')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });
  });

  describe('login', () => {
    const credentials = { email: 'a@b.com', password: 'x' } as never;

    it('returns the user and token from the downstream as they are', async () => {
      const session = { user: { id: '1', email: 'a@b.com' }, token: 'jwt' };
      httpClient.request.mockResolvedValue(session);

      await expect(service.login(credentials)).resolves.toEqual(session);
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
      role: 'seller',
    } as never;

    it('forwards the fields in camelCase and returns the created user', async () => {
      const created = { id: '1', email: 'a@b.com', role: 'seller' };
      httpClient.request.mockResolvedValue(created);

      await expect(service.register(payload)).resolves.toEqual(created);

      expect(httpClient.request).toHaveBeenCalledWith('users', {
        method: 'POST',
        path: '/auth/register',
        body: {
          email: 'a@b.com',
          password: 'x',
          firstName: 'Ana',
          lastName: 'Silva',
          role: 'seller',
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

  describe('metrics', () => {
    const credentials = { email: 'a@b.com', password: 'x' } as never;
    let operations: ReturnType<typeof vi.spyOn>;
    let duration: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // The instruments are OpenTelemetry no-ops until a meter provider is
      // registered, which never happens under NODE_ENV=test — spying on them
      // is enough to assert what the service reports.
      operations = vi.spyOn(metrics.auth_operations, 'add');
      duration = vi.spyOn(metrics.auth_operation_duration, 'record');
    });

    it('counts a successful login once, by operation and outcome', async () => {
      httpClient.request.mockResolvedValue({ user: {}, token: 'jwt' });

      await service.login(credentials);

      expect(operations).toHaveBeenCalledTimes(1);
      expect(operations).toHaveBeenCalledWith(1, {
        operation: 'login',
        outcome: 'succeeded',
      });
      expect(duration).toHaveBeenCalledTimes(1);
    });

    // The split is the whole point: bad credentials and a users service outage
    // must not look alike on a dashboard.
    it('counts rejected credentials apart from an outage', async () => {
      httpClient.request.mockRejectedValueOnce(
        new HttpRequestError(401, 'nope')
      );
      await expect(service.login(credentials)).rejects.toThrow();

      httpClient.request.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.login(credentials)).rejects.toThrow();

      expect(operations).toHaveBeenCalledWith(1, {
        operation: 'login',
        outcome: 'rejected',
      });
      expect(operations).toHaveBeenCalledWith(1, {
        operation: 'login',
        outcome: 'unavailable',
      });
    });

    it('counts a duplicate email as rejected, not as an outage', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(409, 'taken'));

      await expect(
        service.register({
          email: 'a@b.com',
          password: 'x',
          firstName: 'Ana',
          lastName: 'Silva',
        } as never)
      ).rejects.toThrow();

      expect(operations).toHaveBeenCalledWith(1, {
        operation: 'register',
        outcome: 'rejected',
      });
    });

    it('counts a rejected JWT without reaching the users service', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad');
      });

      await expect(service.validateJwtToken('token')).rejects.toThrow();

      expect(operations).toHaveBeenCalledWith(1, {
        operation: 'validate_jwt',
        outcome: 'rejected',
      });
      expect(httpClient.request).not.toHaveBeenCalled();
    });

    it('carries no unbounded attribute into the counter', async () => {
      httpClient.request.mockRejectedValue(new HttpRequestError(401, 'nope'));

      await expect(service.login(credentials)).rejects.toThrow();

      // An email or a user id as an attribute mints a time series per person;
      // only closed sets belong here.
      const [, attributes] = operations.mock.calls[0];

      expect(Object.keys(attributes as object).sort()).toEqual([
        'operation',
        'outcome',
      ]);
    });
  });
});
