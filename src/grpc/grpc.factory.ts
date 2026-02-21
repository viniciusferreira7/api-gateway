import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import type { GatewayService } from '@/gateway/gateway.service';
import { GrpcConfigService } from './grpc.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

@Injectable()
export class GrpcClientFactory {
  private readonly clients = new Map<string, ClientProxy>();

  constructor(private readonly grpcConfig: GrpcConfigService) {}

  getClient(serviceName: ServicesName, url: string): ClientProxy {
    if (!this.clients.has(serviceName)) {
      const client = ClientProxyFactory.create(
        this.grpcConfig.createOptions(serviceName, url)
      );
      this.clients.set(serviceName, client);
    }

    // biome-ignore lint/style/noNonNullAssertion: Its using Hashmap
    return this.clients.get(serviceName)!;
  }
}
