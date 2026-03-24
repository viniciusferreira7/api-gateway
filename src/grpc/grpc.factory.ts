import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { ClientGrpc, ClientProxyFactory } from '@nestjs/microservices';
import { GatewayService } from '@/gateway/gateway.service';
import { GrpcConfigService } from './grpc.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

@Injectable()
export class GrpcClientFactory {
  private readonly clients = new Map<string, ClientGrpc>();
  private readonly healthClients = new Map<string, ClientGrpc>();

  constructor(
    private readonly grpcConfig: GrpcConfigService,
    private readonly gatewayService: GatewayService
  ) {}

  getClient(serviceName: ServicesName): ClientGrpc {
    if (!this.clients.has(serviceName)) {
      const { url } = this.gatewayService.serviceConfig()[serviceName];
      const client = ClientProxyFactory.create(
        this.grpcConfig.createOptions(serviceName, url)
      ) as unknown as ClientGrpc;
      this.clients.set(serviceName, client);
    }

    // biome-ignore lint/style/noNonNullAssertion: Its using Hashmap
    return this.clients.get(serviceName)!;
  }

  getService<T extends object>(serviceName: ServicesName, grpcServiceName: string): T {
    const client = this.getClient(serviceName);
    const service = client.getService<T>(grpcServiceName);
    const { timeout } = this.gatewayService.serviceConfig()[serviceName];

    return new Proxy(service, {
      get(target, prop) {
        const method = target[prop as keyof T];
        if (typeof method !== 'function') return method;
        return (request: unknown, metadata?: Metadata) => {
          const deadline = new Date(Date.now() + timeout);
          return (method as Function).call(
            target,
            request,
            metadata ?? new Metadata(),
            { deadline }
          );
        };
      },
    }) as T;
  }

  getHealthClient(serviceName: ServicesName, url: string): ClientGrpc {
    if (!this.healthClients.has(serviceName)) {
      const client = ClientProxyFactory.create(
        this.grpcConfig.createHealthOptions(url)
      ) as unknown as ClientGrpc;
      this.healthClients.set(serviceName, client);
    }

    // biome-ignore lint/style/noNonNullAssertion: Its using Hashmap
    return this.healthClients.get(serviceName)!;
  }
}
