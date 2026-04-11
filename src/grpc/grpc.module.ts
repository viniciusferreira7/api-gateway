import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { GrpcClientFactory } from './factories/grpc.factory';
import { GrpcConfigService } from './services/grpc.service';

@Module({
  imports: [GatewayModule],
  providers: [GrpcConfigService, GrpcClientFactory, CircuitBreakerService],
  exports: [GrpcConfigService, GrpcClientFactory],
})
export class GrpcModule {}
