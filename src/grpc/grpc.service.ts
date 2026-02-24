import { Injectable } from '@nestjs/common';
import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GatewayService } from '@/gateway/gateway.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;
type Urls<T extends ServicesName> = ReturnType<
  GatewayService['serviceConfig']
>[T]['url'];

@Injectable()
export class GrpcConfigService {
  public createOptions(
    serviceName: ServicesName,
    url: Urls<ServicesName>
  ): ClientOptions {
    return {
      transport: Transport.GRPC,
      options: {
        package: serviceName,
        protoPath: join(process.cwd(), 'src/proto', `${serviceName}.proto`),
        url,
      },
    };
  }

  public createHealthOptions(url: string): ClientOptions {
    return {
      transport: Transport.GRPC,
      options: {
        package: 'grpc.health.v1',
        protoPath: join(process.cwd(), 'src/proto', 'health.proto'),
        url,
      },
    };
  }
}
