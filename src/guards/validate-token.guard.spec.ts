import type { ExecutionContext } from '@nestjs/common';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidateTokenGuard } from './validate-token.guard';

function makeContext(headers: Record<string, unknown>) {
  const request = { headers } as Record<string, unknown>;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never as ExecutionContext;

  return { context, request };
}

describe('ValidateTokenGuard', () => {
  let guard: ValidateTokenGuard;
  let authService: { validateToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { validateToken: vi.fn() };
    guard = new ValidateTokenGuard(authService as never);
  });

  it.each([
    ['missing', {}],
    ['not a bearer', { authorization: 'Basic dXNlcjpwYXNz' }],
    ['an empty bearer', { authorization: 'Bearer ' }],
    ['a bearer with spaces', { authorization: 'Bearer a b' }],
  ])('refuses an authorization header that is %s without calling the users service', async (_, headers) => {
    const { context } = makeContext(headers);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(authService.validateToken).not.toHaveBeenCalled();
  });

  it('puts the validated user on the request and lets it through', async () => {
    authService.validateToken.mockResolvedValue({
      userId: '1',
      email: 'a@b.com',
      role: 'seller',
    });
    const { context, request } = makeContext({ authorization: 'Bearer t' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.validateToken).toHaveBeenCalledWith('Bearer t');
    expect(request.user).toEqual({ id: '1', email: 'a@b.com', role: 'seller' });
  });

  it('propagates a refusal from the users service', async () => {
    authService.validateToken.mockRejectedValue(new UnauthorizedException());
    const { context } = makeContext({ authorization: 'Bearer t' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  // Turning an outage into 401 would send every client back to the login page.
  it('keeps an outage as 503', async () => {
    authService.validateToken.mockRejectedValue(
      new ServiceUnavailableException()
    );
    const { context } = makeContext({ authorization: 'Bearer t' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
