import type { ThrottlerRequest } from '@nestjs/throttler';
import { ThrottlerException } from '@nestjs/throttler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomThrottlerGuard } from './throttler.guard';

interface MutableGuard {
  getTracker(req: Record<string, unknown>): Promise<string>;
  handleRequest(request: ThrottlerRequest): Promise<boolean>;
  storageService: { increment: ReturnType<typeof vi.fn> };
  headerPrefix: string;
  getRequestResponse: ReturnType<typeof vi.fn>;
}

describe('CustomThrottlerGuard', () => {
  let guard: MutableGuard;
  let res: { setHeader: ReturnType<typeof vi.fn> };
  let req: Record<string, unknown>;

  beforeEach(() => {
    guard = Object.create(CustomThrottlerGuard.prototype);
    res = { setHeader: vi.fn() };
    req = { ip: '1.2.3.4', headers: { 'user-agent': 'UA' } };
    guard.storageService = { increment: vi.fn() };
    guard.headerPrefix = 'X-RateLimit';
    guard.getRequestResponse = vi.fn(() => ({ req, res }));
  });

  it('rastreia por combinação de IP e user-agent', async () => {
    await expect(guard.getTracker(req)).resolves.toBe('1.2.3.4-UA');
  });

  function buildRequest(): ThrottlerRequest {
    return {
      context: {} as never,
      limit: 5,
      ttl: 60_000,
      blockDuration: 60_000,
      generateKey: vi.fn(() => 'key'),
    } as never;
  }

  it('libera e escreve os headers de limite quando dentro da cota', async () => {
    guard.storageService.increment.mockResolvedValue({ totalHits: 3 });

    await expect(guard.handleRequest(buildRequest())).resolves.toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
  });

  it('bloqueia com Retry-After quando estoura a cota', async () => {
    guard.storageService.increment.mockResolvedValue({ totalHits: 6 });

    await expect(guard.handleRequest(buildRequest())).rejects.toBeInstanceOf(
      ThrottlerException
    );
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });
});
