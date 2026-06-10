import { Injectable, Logger } from '@nestjs/common';
import { request } from 'undici';
import { GatewayService } from '@/gateway/services/gateway.service';
import { CircuitBreakerService } from './circuit-breaker.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly circuitBreakerService: CircuitBreakerService
  ) {}

  async request<T>(
    serviceName: ServicesName,
    options: HttpRequestOptions
  ): Promise<T> {
    const { url, timeout } = this.gatewayService.serviceConfig()[serviceName];
    const breaker = this.circuitBreakerService.getBreaker(serviceName);

    const call = () => this.dispatch<T>(url, timeout, options);

    return breaker.fire(call) as Promise<T>;
  }

  private async dispatch<T>(
    baseUrl: string,
    timeout: number,
    { method, path, body, headers }: HttpRequestOptions
  ): Promise<T> {
    const targetUrl = `${baseUrl}${path}`;

    const { statusCode, body: responseBody } = await request(targetUrl, {
      method,
      signal: AbortSignal.timeout(timeout),
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (statusCode < 200 || statusCode >= 300) {
      // Drain the body to avoid leaking sockets; never forward its contents.
      await responseBody.dump();
      this.logger.warn(
        `Downstream responded ${statusCode} for ${method} ${path}`
      );
      throw new HttpRequestError(
        statusCode,
        `Downstream request failed with status ${statusCode}`
      );
    }

    const text = await responseBody.text();
    if (text.length === 0) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}
