import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GatewayService } from '@/gateway/services/gateway.service';
import {
  HttpClientService,
  HttpRequestError,
  type HttpRequestOptions,
} from '@/http/services/http-client.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly httpClient: HttpClientService) {}

  public async proxyRequest(
    serviceName: ServicesName,
    options: HttpRequestOptions,
    userInfo?: { id: string; email: string; role: string }
  ) {
    this.logger.log(`Proxying HTTP call to ${serviceName} ${options.path}`);

    // Allowlist forwarded headers. Never trust client-supplied identity
    // headers: the gateway is the only authority for x-user-* and always
    // derives them from the authenticated userInfo.
    const headers: Record<string, string> = {};
    if (options.headers?.authorization) {
      headers.authorization = options.headers.authorization;
    }
    if (userInfo?.id) {
      headers['x-user-id'] = userInfo.id;
      headers['x-user-email'] = userInfo.email;
      headers['x-user-role'] = userInfo.role;
    }

    try {
      return await this.httpClient.request(serviceName, {
        ...options,
        headers,
      });
    } catch (error) {
      this.logger.error(
        `Error proxying HTTP call to ${serviceName} ${options.path}`,
        error
      );

      // A downstream answer keeps its status for the exception filter. Anything
      // else — a timeout, a refused connection, an open breaker — never reached
      // the service, which is a 503, not an unexplained 500.
      if (error instanceof HttpRequestError) {
        throw error;
      }

      throw new ServiceUnavailableException();
    }
  }

  /**
   * Only the verdict leaves this method: the cause names hosts and ports and
   * goes to the log, never to the public healthz body.
   */
  public async getServiceHealth(
    serviceName: ServicesName
  ): Promise<{ status: 'healthy' | 'unhealthy' }> {
    try {
      await this.httpClient.request(serviceName, {
        method: 'GET',
        path: '/health',
      });

      return { status: 'healthy' };
    } catch (error) {
      this.logger.warn(
        `${serviceName} health check failed: ${error instanceof Error ? error.message : String(error)}`
      );

      return { status: 'unhealthy' };
    }
  }
}
