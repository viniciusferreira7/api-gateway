import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GrpcClientFactory } from './grpc.factory';
import { GrpcConfigService } from './grpc.service';

@Module({
  imports: [GatewayModule],
  providers: [GrpcConfigService, GrpcClientFactory, CircuitBreakerService],
  exports: [GrpcConfigService, GrpcClientFactory],
})
export class GrpcModule {}
