import { Injectable, Logger } from '@nestjs/common';
import { GatewayService } from '@/gateway/services/gateway.service';
import {
  HttpClientService,
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
      throw error;
    }
  }

  public async getServiceHealth(serviceName: ServicesName) {
    try {
      await this.httpClient.request(serviceName, {
        method: 'GET',
        path: '/healthz',
      });

      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'unknown error',
      };
    }
  }
}
