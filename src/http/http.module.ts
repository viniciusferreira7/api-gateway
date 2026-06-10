import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HttpClientService } from './services/http-client.service';

@Module({
  imports: [GatewayModule],
  providers: [HttpClientService, CircuitBreakerService],
  exports: [HttpClientService],
})
export class HttpModule {}
