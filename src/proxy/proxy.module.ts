import { Module } from '@nestjs/common';
import { GrpcModule } from '@/grpc/grpc.module';
import { ProxyService } from './proxy.service';

@Module({
  imports: [GrpcModule],
  providers: [ProxyService],
})
export class ProxyModule {}
