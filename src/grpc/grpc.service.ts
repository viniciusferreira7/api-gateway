import { Injectable } from '@nestjs/common';
import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GatewayService } from '@/gateway/gateway.service';

@Injectable()
export class GrpcConfigService {
  constructor(private readonly gatewayService: GatewayService) {}

  public createOptions(
    serviceName: keyof ReturnType<GatewayService['serviceConfig']>,
    packageName: string,
    protoFile: string
  ): ClientOptions {
    const service = this.gatewayService.serviceConfig[serviceName];

    return {
      transport: Transport.GRPC,
      options: {
        package: packageName,
        protoPath: join(__dirname, `../proto/${protoFile}`),
        url: service.url,
      },
    };
  }
}
