import { beforeEach, describe, expect, it } from 'vitest';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
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
});
