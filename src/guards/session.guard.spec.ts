import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from './session.guard';

function makeContext(headers: Record<string, unknown>) {
  const request = { headers } as Record<string, unknown>;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never as ExecutionContext;

  return { context, request };
}

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let authService: { validateSessionToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { validateSessionToken: vi.fn() };
    guard = new SessionGuard(authService as never);
  });

  it('lança Unauthorized quando não há x-session-token', async () => {
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('lança Unauthorized quando a sessão é inválida', async () => {
    authService.validateSessionToken.mockResolvedValue({
      valid: false,
      user: null,
    });
    const { context } = makeContext({ 'x-session-token': 's' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('lança Unauthorized quando o authService falha', async () => {
    authService.validateSessionToken.mockRejectedValue(new Error('down'));
    const { context } = makeContext({ 'x-session-token': 's' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('injeta o usuário na request e permite quando a sessão é válida', async () => {
    const user = { id: '1', role: 'admin' };
    authService.validateSessionToken.mockResolvedValue({ valid: true, user });
    const { context, request } = makeContext({ 'x-session-token': 's' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(user);
  });
});
