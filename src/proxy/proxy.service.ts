import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import type { GatewayService } from '@/gateway/gateway.service';
import { GrpcClientFactory } from '@/grpc/grpc.factory';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly grpcClientFactory: GrpcClientFactory,
    private readonly gatewayService: GatewayService
  ) {}

  public async proxyRequest(
    serviceName: ServicesName,
    method: string,
    body?: Record<string, unknown>,
    headers?: Record<string, unknown>,
    userInfo?: { id: string; email: string; role: string }
  ) {
    const serviceConfig = this.gatewayService.serviceConfig();
    const service = serviceConfig[serviceName];

    this.logger.log(`Proxying gRPC call to ${serviceName}/${method}`);

    const payload = {
      ...body,
      ...(headers && { headers }),
      ...(userInfo && {
        userId: userInfo.id,
        userEmail: userInfo.email,
        userRole: userInfo.role,
      }),
    };

    try {
      const client = this.grpcClientFactory.getClient(serviceName, service.url);
      return await lastValueFrom(client.send(method, payload));
    } catch (error) {
      this.logger.error(
        `Error proxying gRPC call to ${serviceName}/${method}`,
        error
      );
      throw error;
    }
  }

  public async serviceHealth() {}
}
