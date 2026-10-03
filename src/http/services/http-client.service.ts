import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { request } from 'undici';
import { GatewayService } from '@/gateway/services/gateway.service';
import { metrics } from '@/observability/metrics';
import { HttpRequestError } from '../errors/http-request.error';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RetryService } from './retry.service';

export { HttpRequestError };

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

type UpstreamOutcome =
  | 'succeeded'
  | 'client_error'
  | 'server_error'
  | 'circuit_open'
  | 'unreachable';

const IDEMPOTENT_METHODS = new Set<HttpMethod>(['GET', 'PUT', 'DELETE']);
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly retryService: RetryService
  ) {}

  async request<T>(
    serviceName: ServicesName,
    options: HttpRequestOptions
  ): Promise<T> {
    const { url, timeout } = this.gatewayService.serviceConfig()[serviceName];
    const breaker = this.circuitBreakerService.getBreaker(serviceName);

    const dispatch = () => this.dispatch<T>(url, timeout, options);

    const call = IDEMPOTENT_METHODS.has(options.method)
      ? () =>
          this.retryService.run(dispatch, {
            isRetryable: HttpClientService.isRetryable,
            retryAfterMs: HttpClientService.retryAfterMs,
            onRetry: () =>
              metrics.upstream_retries.add(1, { service: serviceName }),
          })
      : dispatch;

    const startedAt = Date.now();

    try {
      const result = (await breaker.fire(call)) as T;

      this.settle(serviceName, 'succeeded', startedAt);

      return result;
    } catch (error) {
      this.settle(serviceName, HttpClientService.outcomeOf(error), startedAt);

      throw error;
    }
  }

  /**
   * Records how one downstream call ended. The duration covers retries and the
   * breaker, because that is the latency the caller actually waited.
   *
   * Attributes are the service and a five-word outcome. The path is left out
   * on purpose: `/orders/:id` arrives here already interpolated, so it would
   * mint a time series per id.
   */
  private settle(
    service: string,
    outcome: UpstreamOutcome,
    startedAt: number
  ): void {
    metrics.upstream_requests.add(1, { service, outcome });
    metrics.upstream_request_duration.record(Date.now() - startedAt, {
      service,
      outcome,
    });
  }

  /**
   * Buckets a failure by who caused it. `circuit_open` is the breaker refusing
   * to dial at all — opossum tags that rejection `EOPENBREAKER` — and it is
   * worth its own bucket: it means this gateway shed the call, not that the
   * downstream answered badly.
   */
  private static outcomeOf(error: unknown): UpstreamOutcome {
    if (error instanceof HttpRequestError) {
      return error.status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'server_error'
        : 'client_error';
    }

    if ((error as { code?: unknown })?.code === 'EOPENBREAKER') {
      return 'circuit_open';
    }

    return 'unreachable';
  }

  private async dispatch<T>(
    baseUrl: string,
    timeout: number,
    { method, path, body, headers }: HttpRequestOptions
  ): Promise<T> {
    const targetUrl = `${baseUrl}${path}`;

    const {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
    } = await request(targetUrl, {
      method,
      signal: AbortSignal.timeout(timeout),
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (statusCode < 200 || statusCode >= 300) {
      await responseBody.dump();
      this.logger.warn(
        `Downstream responded ${statusCode} for ${method} ${path}`
      );
      throw new HttpRequestError(
        statusCode,
        `Downstream request failed with status ${statusCode}`,
        HttpClientService.parseRetryAfter(responseHeaders['retry-after'])
      );
    }

    const text = await responseBody.text();
    if (text.length === 0) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  private static isRetryable(error: unknown): boolean {
    if (error instanceof HttpRequestError) {
      return RETRYABLE_STATUS.has(error.status);
    }

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return true;
      }

      return typeof (error as { code?: unknown }).code === 'string';
    }

    return false;
  }

  private static retryAfterMs(error: unknown): number | undefined {
    return error instanceof HttpRequestError ? error.retryAfterMs : undefined;
  }

  private static parseRetryAfter(
    value: string | string[] | undefined
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const raw = Array.isArray(value) ? value[0] : value;

    const seconds = Number(raw);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1_000);
    }

    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp)
      ? undefined
      : Math.max(0, timestamp - Date.now());
  }
}
