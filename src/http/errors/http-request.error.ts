/**
 * A downstream service answered with a non-2xx status. Lives apart from
 * `HttpClientService` so the circuit breaker can tell it apart from a
 * network failure without importing the client (which imports the breaker).
 */
export class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
    /**
     * The `message` of a 4xx body, already checked to be short text. Safe to
     * show the client; the 4xx body is otherwise never forwarded.
     */
    public readonly upstreamMessage?: string | string[]
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}
