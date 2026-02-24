import { Injectable, Logger } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { firstValueFrom, Observable } from 'rxjs';
import type { GatewayService } from '@/gateway/gateway.service';
import { GrpcClientFactory } from '@/grpc/grpc.factory';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;
type GrpcStub = Record<string, (data: unknown, metadata: Metadata) => Observable<unknown>>;

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
      ...(userInfo && {
        userId: userInfo.id,
        userEmail: userInfo.email,
        userRole: userInfo.role,
      }),
    };

    const metadata = new Metadata();
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (key === 'authorization' || key.startsWith('x-')) {
          metadata.add(key, value as string);
        }
      }
    }

    try {
      const grpcClient = this.grpcClientFactory.getClient(serviceName, service.url);
      const grpcServiceName = `${serviceName[0].toUpperCase()}${serviceName.slice(1)}Service`;
      const stub = grpcClient.getService<GrpcStub>(grpcServiceName);
      return await firstValueFrom(stub[method](payload, metadata));
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
