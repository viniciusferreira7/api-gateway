import { Injectable } from '@nestjs/common';
import { ClientGrpc, ClientProxyFactory } from '@nestjs/microservices';
import type { GatewayService } from '@/gateway/gateway.service';
import { GrpcConfigService } from './grpc.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

@Injectable()
export class GrpcClientFactory {
  private readonly clients = new Map<string, ClientGrpc>();
  private readonly healthClients = new Map<string, ClientGrpc>();

  constructor(private readonly grpcConfig: GrpcConfigService) {}

  getClient(serviceName: ServicesName, url: string): ClientGrpc {
    if (!this.clients.has(serviceName)) {
      const client = ClientProxyFactory.create(
        this.grpcConfig.createOptions(serviceName, url)
      ) as unknown as ClientGrpc;
      this.clients.set(serviceName, client);
    }

    // biome-ignore lint/style/noNonNullAssertion: Its using Hashmap
    return this.clients.get(serviceName)!;
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
