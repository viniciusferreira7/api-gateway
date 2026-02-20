import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ClientOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import type { Env } from '@/env/env';

@Injectable()
export class GrpcConfigService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  //TODO: Need proxy service

  createOptions(
    packageName: string,
    protoFile: string,
    url: string
  ): ClientOptions {
    return {
      transport: Transport.GRPC,
      options: {
        package: packageName,
        protoPath: join(__dirname, `../proto/${protoFile}`),
        url,
      },
    };
  }
}
