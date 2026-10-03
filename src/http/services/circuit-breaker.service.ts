import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { GatewayService } from '@/gateway/services/gateway.service';
import { metrics } from '@/observability/metrics';
import { HttpRequestError } from '../errors/http-request.error';

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
          // A 4xx is the caller's fault and proves the service is up. Counting
          // it would let five wrong passwords or bad tokens open the breaker
          // and take login down for everyone. Still rejected to the caller.
          errorFilter: (error: unknown) =>
            error instanceof HttpRequestError &&
            error.status < HttpStatus.INTERNAL_SERVER_ERROR,
        }
      );

      breaker.on('open', () => {
        metrics.circuit_breaker_transitions.add(1, {
          service: serviceName,
          state: 'open',
        });
        this.logger.warn(`[${serviceName}] Circuit breaker OPEN`);
      });
      breaker.on('halfOpen', () => {
        metrics.circuit_breaker_transitions.add(1, {
          service: serviceName,
          state: 'half_open',
        });
        this.logger.log(`[${serviceName}] Circuit breaker HALF-OPEN`);
      });
      breaker.on('close', () => {
        metrics.circuit_breaker_transitions.add(1, {
          service: serviceName,
          state: 'closed',
        });
        this.logger.log(`[${serviceName}] Circuit breaker CLOSED`);
      });

      this.breakers.set(serviceName, breaker);
    }

    // biome-ignore lint/style/noNonNullAssertion: key was just set above
    return this.breakers.get(serviceName)!;
  }
}
