import { Module } from '@nestjs/common';
import { GatewayModule } from '@/gateway/gateway.module';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { HttpClientService } from './services/http-client.service';
import { RetryService } from './services/retry.service';

@Module({
  imports: [GatewayModule],
  providers: [HttpClientService, CircuitBreakerService, RetryService],
  exports: [HttpClientService],
})
export class HttpModule {}
