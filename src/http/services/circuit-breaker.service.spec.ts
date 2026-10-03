import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpRequestError } from '@/http/errors/http-request.error';
import { metrics } from '@/observability/metrics';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    service.getBreaker('users').shutdown();
  });

  it('reutiliza o mesmo breaker por serviço', () => {
    const first = service.getBreaker('users');
    const second = service.getBreaker('users');

    expect(second).toBe(first);
  });

  it('cria breakers distintos para serviços distintos', () => {
    expect(service.getBreaker('users')).not.toBe(
      service.getBreaker('products')
    );
  });

  it('executa a ação passada para o fire', async () => {
    const breaker = service.getBreaker('users');

    await expect(breaker.fire(async () => 'ok')).resolves.toBe('ok');
  });

  describe('metrics', () => {
    it('counts a state change, by service and new state', () => {
      const transitions = vi.spyOn(metrics.circuit_breaker_transitions, 'add');
      const breaker = service.getBreaker('users');

      breaker.open();
      breaker.close();

      expect(transitions).toHaveBeenCalledWith(1, {
        service: 'users',
        state: 'open',
      });
      expect(transitions).toHaveBeenCalledWith(1, {
        service: 'users',
        state: 'closed',
      });

      transitions.mockRestore();
    });
  });

  describe('failure accounting', () => {
    // Above `volumeThreshold: 5`, so the breaker is allowed to trip.
    const RUN = 6;

    async function failRepeatedly(error: unknown) {
      const breaker = service.getBreaker('users');

      for (let i = 0; i < RUN; i++) {
        await breaker.fire(() => Promise.reject(error)).catch(() => undefined);
      }

      return breaker;
    }

    it.each([
      400, 401, 404, 409, 429,
    ])('stays closed after a run of downstream %i', async (status) => {
      const breaker = await failRepeatedly(
        new HttpRequestError(status, 'rejected')
      );

      expect(breaker.opened).toBe(false);
      await expect(breaker.fire(async () => 'ok')).resolves.toBe('ok');
    });

    it('still rejects a 4xx to the caller', async () => {
      const breaker = service.getBreaker('users');
      const rejection = new HttpRequestError(401, 'nope');

      await expect(breaker.fire(() => Promise.reject(rejection))).rejects.toBe(
        rejection
      );
    });

    it('opens after a run of downstream 5xx', async () => {
      const breaker = await failRepeatedly(new HttpRequestError(503, 'down'));

      expect(breaker.opened).toBe(true);
    });

    it('opens after a run of calls that never reached the service', async () => {
      const breaker = await failRepeatedly(new Error('ECONNREFUSED'));

      expect(breaker.opened).toBe(true);
    });
  });
});
