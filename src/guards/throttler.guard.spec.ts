import type { ThrottlerRequest } from '@nestjs/throttler';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  // The User-Agent is set by the client: keying on it let anyone get a fresh
  // counter per request by changing one header, which defeats the login
  // brute-force limit.
  it('tracks by IP only, whatever the user-agent', async () => {
    const other = { ip: '1.2.3.4', headers: { 'user-agent': 'other-UA' } };

    await expect(guard.getTracker(req)).resolves.toBe('1.2.3.4');
    await expect(guard.getTracker(other)).resolves.toBe('1.2.3.4');
  });

  it('ignores a client-supplied X-Forwarded-For', async () => {
    const forged = {
      ip: '1.2.3.4',
      headers: { 'x-forwarded-for': '9.9.9.9', 'user-agent': 'UA' },
    };

    await expect(guard.getTracker(forged)).resolves.toBe('1.2.3.4');
  });

  function buildRequest(): ThrottlerRequest {
    return {
      context: {} as never,
      limit: 5,
      ttl: 60_000,
      blockDuration: 60_000,
      throttler: { name: 'short' },
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

  describe('named throttlers', () => {
    let storage: ThrottlerStorageService;

    // What the app registers: three windows, each with its own counter.
    const throttlers = [
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 900_000, limit: 1_000 },
    ];

    beforeEach(() => {
      storage = new ThrottlerStorageService();
      guard.storageService = storage as never;
    });

    afterEach(() => {
      storage.onApplicationShutdown();
    });

    /** One request, the way ThrottlerGuard.canActivate runs it: once per throttler. */
    async function hit(limits: Partial<Record<string, number>> = {}) {
      for (const throttler of throttlers) {
        const limit = limits[throttler.name] ?? throttler.limit;

        await guard.handleRequest({
          context: {} as never,
          limit,
          ttl: throttler.ttl,
          blockDuration: throttler.ttl,
          throttler,
          generateKey: (_context: unknown, tracker: string, name: string) =>
            `${name}-${tracker}`,
        } as never);
      }
    }

    it('lets a request use exactly the limit of each window', async () => {
      // `@Throttle({ short: { limit: 3 } })`, as on POST /auth/register.
      for (let i = 0; i < 3; i++) {
        await expect(hit({ short: 3 })).resolves.toBeUndefined();
      }

      await expect(hit({ short: 3 })).rejects.toBeInstanceOf(
        ThrottlerException
      );
    });

    it('counts each window apart', async () => {
      await hit();

      expect(
        [...storage.storage.keys()].map((key) => key.split('-')[0]).sort()
      ).toEqual(['long', 'medium', 'short']);
    });
  });
});
