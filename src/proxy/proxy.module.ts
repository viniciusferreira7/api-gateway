import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { GrpcModule } from '@/grpc/grpc.module';
import { ProxyService } from './proxy.service';

@Module({
  imports: [GrpcModule, GatewayModule],
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule {}
