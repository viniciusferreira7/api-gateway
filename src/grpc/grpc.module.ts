import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { GrpcClientFactory } from './grpc.factory';
import { GrpcConfigService } from './grpc.service';

@Module({
  imports: [GatewayModule],
  providers: [GrpcConfigService, GrpcClientFactory],
  exports: [GrpcConfigService, GrpcClientFactory],
})
export class GrpcModule {}
