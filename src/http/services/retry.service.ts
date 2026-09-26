import { Injectable } from '@nestjs/common';

export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  capMs?: number;
  budgetMs?: number;
  isRetryable: (error: unknown) => boolean;
  retryAfterMs?: (error: unknown) => number | undefined;
  /**
   * Called once per retry, after the decision is final — the error is
   * retryable, an attempt is left and the delay fits the budget. The caller
   * owns what it means, which is what keeps this service free of the service
   * name a metric attribute needs.
   */
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULTS = {
  attempts: 5,
  baseMs: 250,
  capMs: 5_000,
  budgetMs: 10_000,
} as const;

@Injectable()
export class RetryService {
  async run<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    const {
      attempts = DEFAULTS.attempts,
      baseMs = DEFAULTS.baseMs,
      capMs = DEFAULTS.capMs,
      budgetMs = DEFAULTS.budgetMs,
      isRetryable,
      retryAfterMs,
      onRetry,
    } = options;

    const start = Date.now();

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        if (attempt >= attempts || !isRetryable(error)) {
          throw error;
        }

        const delay = this.nextDelay({
          attempt,
          baseMs,
          capMs,
          retryAfter: retryAfterMs?.(error),
        });

        if (Date.now() - start + delay > budgetMs) {
          throw error;
        }

        onRetry?.(attempt, error);

        await this.sleep(delay);
      }
    }
  }

  private nextDelay({
    attempt,
    baseMs,
    capMs,
    retryAfter,
  }: {
    attempt: number;
    baseMs: number;
    capMs: number;
    retryAfter?: number;
  }): number {
    const backoff = Math.min(baseMs * 2 ** (attempt - 1), capMs);
    const jittered = Math.random() * backoff;

    return retryAfter === undefined ? jittered : Math.max(jittered, retryAfter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
