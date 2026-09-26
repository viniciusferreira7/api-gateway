import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryService } from './retry.service';

describe('RetryService', () => {
  let service: RetryService;

  beforeEach(() => {
    service = new RetryService();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retenta e sucede quando a primeira tentativa falha com erro retryable', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('boom');
      }
      return 'ok';
    });

    const promise = service.run(fn, { isRetryable: () => true });
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onRetry once per retry, with the attempt that failed', async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('boom');
      }
      return 'ok';
    });

    const promise = service.run(fn, { isRetryable: () => true, onRetry });
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2]);
  });

  it('does not call onRetry when the error is not retryable', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn(async () => {
      throw new Error('bad request');
    });

    await expect(
      service.run(fn, { isRetryable: () => false, onRetry })
    ).rejects.toThrow('bad request');
    expect(onRetry).not.toHaveBeenCalled();
  });

  // The hook marks a retry that happens, not one that was considered: a delay
  // that blows the budget ends the call instead.
  it('does not call onRetry when the delay would exceed the budget', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const onRetry = vi.fn();
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(
      service.run(fn, { isRetryable: () => true, budgetMs: 0, onRetry })
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('não retenta quando o erro não é retryable', async () => {
    const error = new Error('bad request');
    const fn = vi.fn(async () => {
      throw error;
    });

    await expect(service.run(fn, { isRetryable: () => false })).rejects.toBe(
      error
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respeita o número máximo de tentativas e relança o último erro', async () => {
    vi.useFakeTimers();
    const error = new Error('boom');
    const fn = vi.fn(async () => {
      throw error;
    });

    const promise = service.run(fn, { isRetryable: () => true });
    const assertion = expect(promise).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;

    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('para de retentar quando o budget se esgota antes das tentativas', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const error = new Error('boom');
    const fn = vi.fn(async () => {
      throw error;
    });

    const promise = service.run(fn, { isRetryable: () => true, budgetMs: 300 });
    const assertion = expect(promise).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('aplica backoff exponencial entre as tentativas', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    const promise = service.run(fn, { isRetryable: () => true });
    // biome-ignore lint/suspicious/noEmptyBlockStatements: unhandled rejection
    promise.catch(() => {});

    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('respeita o Retry-After quando maior que o backoff calculado', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fn = vi.fn(async () => {
      if (fn.mock.calls.length === 1) {
        throw new Error('too many requests');
      }
      return 'ok';
    });

    const promise = service.run(fn, {
      isRetryable: () => true,
      retryAfterMs: () => 1_500,
    });

    await vi.advanceTimersByTimeAsync(1_499);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
