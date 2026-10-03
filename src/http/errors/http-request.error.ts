/**
 * A downstream service answered with a non-2xx status. Lives apart from
 * `HttpClientService` so the circuit breaker can tell it apart from a
 * network failure without importing the client (which imports the breaker).
 */
export class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}
