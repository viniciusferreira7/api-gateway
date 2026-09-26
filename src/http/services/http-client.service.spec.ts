import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('undici', () => ({
  request: (...args: unknown[]) => requestMock(...args),
}));

import { metrics } from '@/observability/metrics';
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

  describe('metrics', () => {
    let requests: ReturnType<typeof vi.spyOn>;
    let duration: ReturnType<typeof vi.spyOn>;
    let retries: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // The instruments are OpenTelemetry no-ops until a meter provider is
      // registered, which never happens under NODE_ENV=test — spying on them
      // is enough to assert what the service reports.
      requests = vi.spyOn(metrics.upstream_requests, 'add');
      duration = vi.spyOn(metrics.upstream_request_duration, 'record');
      retries = vi.spyOn(metrics.upstream_retries, 'add');
    });

    it('counts a successful call once, by service and outcome', async () => {
      requestMock.mockResolvedValueOnce(makeResponse(200, { text: '' }));

      await service.request('users' as never, { method: 'GET', path: '/x' });

      expect(requests).toHaveBeenCalledTimes(1);
      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'succeeded',
      });
      expect(duration).toHaveBeenCalledTimes(1);
    });

    it('buckets a 4xx as a client error', async () => {
      requestMock.mockResolvedValueOnce(makeResponse(400));

      await expect(
        service.request('users' as never, { method: 'POST', path: '/x' })
      ).rejects.toBeInstanceOf(HttpRequestError);

      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'client_error',
      });
    });

    it('buckets a 5xx as a server error', async () => {
      requestMock.mockResolvedValueOnce(makeResponse(503));

      await expect(
        service.request('users' as never, { method: 'POST', path: '/x' })
      ).rejects.toBeInstanceOf(HttpRequestError);

      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'server_error',
      });
    });

    // A shed call is not a downstream failure: the gateway refused to dial.
    it('buckets an open breaker on its own', async () => {
      const rejection = Object.assign(new Error('Breaker is open'), {
        code: 'EOPENBREAKER',
      });
      fire.mockRejectedValueOnce(rejection);

      await expect(
        service.request('users' as never, { method: 'POST', path: '/x' })
      ).rejects.toBe(rejection);

      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'circuit_open',
      });
    });

    it('buckets a call that never reached the downstream', async () => {
      requestMock.mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        })
      );

      await expect(
        service.request('users' as never, { method: 'POST', path: '/x' })
      ).rejects.toThrow('connect ECONNREFUSED');

      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'unreachable',
      });
    });

    // `retries` and `requests` are the SAME spy: with no meter provider
    // registered, every counter `defineMetrics` builds is the one shared
    // NOOP_COUNTER_METRIC from @opentelemetry/api. The attributes are what
    // tell the two instruments apart here, not the call count.
    it('counts one retry per retried attempt, and the call once', async () => {
      vi.useFakeTimers();
      requestMock
        .mockResolvedValueOnce(makeResponse(503))
        .mockResolvedValueOnce(makeResponse(200, { text: '' }));

      const promise = service.request('users' as never, {
        method: 'GET',
        path: '/x',
      });
      await vi.advanceTimersByTimeAsync(10_000);
      await promise;

      expect(retries).toHaveBeenCalledWith(1, { service: 'users' });
      expect(requests).toHaveBeenCalledWith(1, {
        service: 'users',
        outcome: 'succeeded',
      });
      expect(requests).toHaveBeenCalledTimes(2);
    });

    it('carries no unbounded attribute into the counter', async () => {
      requestMock.mockResolvedValueOnce(makeResponse(200, { text: '' }));

      await service.request('users' as never, {
        method: 'GET',
        path: '/orders/3f9a-11',
      });

      // A path with an id in it mints a time series per id; only closed sets
      // belong here.
      const [, attributes] = requests.mock.calls[0];

      expect(Object.keys(attributes as object).sort()).toEqual([
        'outcome',
        'service',
      ]);
    });
  });
});
