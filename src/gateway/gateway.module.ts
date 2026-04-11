import { Module } from '@nestjs/common';
import { GatewayService } from './services/gateway.service';

@Module({
  providers: [GatewayService],
  exports: [GatewayService],
})
export class GatewayModule {}
