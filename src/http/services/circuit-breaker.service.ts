import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { GatewayService } from '@/gateway/services/gateway.service';

type ServicesName = keyof ReturnType<GatewayService['serviceConfig']>;

type BreakerAction = (fn: () => Promise<unknown>) => Promise<unknown>;

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<
    string,
    CircuitBreaker<Parameters<BreakerAction>, unknown>
  >();

  getBreaker(
    serviceName: ServicesName
  ): CircuitBreaker<Parameters<BreakerAction>, unknown> {
    if (!this.breakers.has(serviceName)) {
      const breaker = new CircuitBreaker<Parameters<BreakerAction>, unknown>(
        (fn: () => Promise<unknown>) => fn(),
        {
          name: serviceName,
          timeout: false,
          errorThresholdPercentage: 50,
          resetTimeout: 30_000,
          volumeThreshold: 5,
        }
      );

      breaker.on('open', () =>
        this.logger.warn(`[${serviceName}] Circuit breaker OPEN`)
      );
      breaker.on('halfOpen', () =>
        this.logger.log(`[${serviceName}] Circuit breaker HALF-OPEN`)
      );
      breaker.on('close', () =>
        this.logger.log(`[${serviceName}] Circuit breaker CLOSED`)
      );

      this.breakers.set(serviceName, breaker);
    }

    // biome-ignore lint/style/noNonNullAssertion: key was just set above
    return this.breakers.get(serviceName)!;
  }
}
