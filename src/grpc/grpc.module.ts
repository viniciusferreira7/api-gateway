import { Module } from '@nestjs/common';
import { GrpcConfigService } from './grpc.service';

@Module({
  imports: [GrpcConfigService],
})
export class GrpcModule {}
