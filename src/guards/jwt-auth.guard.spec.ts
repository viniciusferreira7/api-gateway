import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
  } as never;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('libera rotas públicas sem acionar a estratégia', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const superProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const superCanActivate = vi
      .spyOn(superProto, 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('delega para a estratégia JWT em rotas protegidas', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const superProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const superCanActivate = vi
      .spyOn(superProto, 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(superCanActivate).toHaveBeenCalledOnce();
  });

  describe('handleRequest', () => {
    it('retorna o usuário autenticado', () => {
      const user = { userId: '1' };

      expect(guard.handleRequest(null as never, user, null as never)).toBe(
        user
      );
    });

    it('lança o erro original quando a estratégia falha', () => {
      const err = new Error('strategy');

      expect(() =>
        guard.handleRequest(err as never, null as never, null as never)
      ).toThrow(err);
    });

    it('lança Unauthorized quando não há usuário', () => {
      expect(() =>
        guard.handleRequest(null as never, null as never, null as never)
      ).toThrow(UnauthorizedException);
    });
  });
});
