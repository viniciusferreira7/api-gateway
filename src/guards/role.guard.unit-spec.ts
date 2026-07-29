import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleGuard } from './role.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    guard = new RoleGuard(reflector as unknown as Reflector);
  });

  it('nega quando a rota não declara roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ role: 'admin' }))).toBe(false);
  });

  it('lança Forbidden quando não há usuário ou role na request', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(makeContext(null))).toThrow(
      ForbiddenException
    );
  });

  it('lança Forbidden quando a role do usuário não está na lista', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(makeContext({ role: 'buyer' }))).toThrow(
      ForbiddenException
    );
  });

  it('permite quando a role do usuário está na lista', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'buyer']);

    expect(guard.canActivate(makeContext({ role: 'buyer' }))).toBe(true);
  });
});
