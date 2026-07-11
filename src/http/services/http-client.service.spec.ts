import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('undici', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}));

import { HttpClientService, HttpRequestError } from './http-client.service';
import { RetryService } from './retry.service';

function makeResponse(
  statusCode: number,
  {
    text = '',
    headers = {},
  }: { text?: string; headers?: Record<string, string> } = {}
) {
  return {
    statusCode,
    headers,
    body: {
      dump: vi.fn().mockResolvedValue(undefined),
      text: vi.fn().mockResolvedValue(text),
    },
  };
}

describe('HttpClientService', () => {
  let service: HttpClientService;
  let fire: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestMock.mockReset();

    const gatewayService = {
      serviceConfig: () => ({
        users: { url: 'http://users', timeout: 10_000 },
      }),
    } as never;

    fire = vi.fn((fn: () => Promise<unknown>) => fn());
    const circuitBreakerService = {
      getBreaker: () => ({ fire }),
    } as never;

    service = new HttpClientService(
      gatewayService,
      circuitBreakerService,
      new RetryService()
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retenta um GET em 503 e sucede na tentativa seguinte', async () => {
    vi.useFakeTimers();
    requestMock
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(
        makeResponse(200, { text: JSON.stringify({ ok: true }) })
      );

    const promise = service.request('users' as never, {
      method: 'GET',
      path: '/x',
    });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(promise).resolves.toEqual({ ok: true });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('não retenta um POST em 503', async () => {
    requestMock.mockResolvedValueOnce(makeResponse(503));

    await expect(
      service.request('users' as never, { method: 'POST', path: '/x' })
    ).rejects.toBeInstanceOf(HttpRequestError);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('não retenta um GET em erro 4xx', async () => {
    requestMock.mockResolvedValueOnce(makeResponse(400));

    await expect(
      service.request('users' as never, { method: 'GET', path: '/x' })
    ).rejects.toBeInstanceOf(HttpRequestError);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('executa a chamada através do circuit breaker', async () => {
    requestMock.mockResolvedValueOnce(makeResponse(200, { text: '' }));

    await service.request('users' as never, { method: 'GET', path: '/x' });

    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('honra o Retry-After num 429 antes de retentar', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    requestMock
      .mockResolvedValueOnce(
        makeResponse(429, { headers: { 'retry-after': '1' } })
      )
      .mockResolvedValueOnce(makeResponse(200, { text: JSON.stringify('ok') }));

    const promise = service.request('users' as never, {
      method: 'GET',
      path: '/x',
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(requestMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
