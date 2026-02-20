import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { GrpcConfigService } from './grpc.service';

@Module({
  imports: [GatewayModule],
  providers: [GrpcConfigService],
  exports: [GrpcConfigService],
})
export class GrpcModule {}
