import { Metadata } from '@grpc/grpc-js';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';
import type { GatewayService } from '@/gateway/gateway.service';
import { GrpcClientFactory } from '@/grpc/grpc.factory';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;
type GrpcStub = Record<
  string,
  (data: unknown, metadata: Metadata) => Observable<unknown>
>;

interface HealthCheckResponse {
  status: 'UNKNOWN' | 'SERVING' | 'NOT_SERVING' | 'SERVICE_UNKNOWN';
}

type HealthStub = {
  check: (data: { service: string }) => Observable<HealthCheckResponse>;
};

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
    };

    const metadata = new Metadata();
    if (headers) {
      metadata.add('authorization', headers.authorization as string);

      if (userInfo?.id) metadata.add('x-user-id', userInfo?.id);
      if (userInfo?.id) metadata.add('x-user-email', userInfo.email);
      if (userInfo?.id) metadata.add('x-user-role', userInfo?.role);
    }

    try {
      const grpcClient = this.grpcClientFactory.getClient(
        serviceName,
        service.url
      );
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

  public async getServiceHealth(serviceName: ServicesName) {
    try {
      const serviceConfig = this.gatewayService.serviceConfig();
      const service = serviceConfig[serviceName];

      const healthClient = this.grpcClientFactory.getHealthClient(
        serviceName,
        service.url
      );

      const stub = healthClient.getService<HealthStub>('Health');
      const response = await firstValueFrom(stub.check({ service: serviceName }));

      return { status: response.status === 'SERVING' ? 'healthy' : 'unhealthy' };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}
