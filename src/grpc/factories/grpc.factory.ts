import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { ClientGrpc, ClientProxyFactory } from '@nestjs/microservices';
import { firstValueFrom, from } from 'rxjs';
import { GatewayService } from '@/gateway/services/gateway.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { GrpcConfigService } from '../services/grpc.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

type ServiceGrpcNameMap = {
  users: 'UsersService';
  products: 'ProductsService';
  checkouts: 'CheckoutsService';
  payments: 'PaymentsService';
};

@Injectable()
export class GrpcClientFactory {
  private readonly clients = new Map<string, ClientGrpc>();
  private readonly healthClients = new Map<string, ClientGrpc>();

  constructor(
    private readonly grpcConfig: GrpcConfigService,
    private readonly gatewayService: GatewayService,
    private readonly circuitBreakerService: CircuitBreakerService
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

  getService<T extends object, S extends ServicesName>(
    serviceName: S,
    grpcServiceName: ServiceGrpcNameMap[S]
  ): T {
    const client = this.getClient(serviceName);
    const service = client.getService<T>(grpcServiceName);
    const { timeout } = this.gatewayService.serviceConfig()[serviceName];

    const breaker = this.circuitBreakerService.getBreaker(serviceName);

    return new Proxy(service, {
      get: (target, prop) => {
        const method = target[prop as keyof T];
        if (typeof method !== 'function') return method;
        return (request: unknown, metadata?: Metadata) => {
          const deadline = new Date(Date.now() + timeout);
          const call = () =>
            firstValueFrom(
              // biome-ignore lint/complexity/noBannedTypes: This is using function
              (method as Function).call(
                target,
                request,
                metadata ?? new Metadata(),
                { deadline }
              )
            );
          return from(breaker.fire(call));
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
