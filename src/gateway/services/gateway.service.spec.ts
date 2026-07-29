import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayService } from './gateway.service';

describe('GatewayService', () => {
  let service: GatewayService;
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const urls: Record<string, string> = {
      USERS_SERVICE_URL: 'http://users',
      PRODUCTS_SERVICE_URL: 'http://products',
      CHECKOUT_SERVICE_URL: 'http://checkouts',
      PAYMENTS_SERVICE_URL: 'http://payments',
    };
    configService = { get: vi.fn((key: string) => urls[key]) };
    service = new GatewayService(configService as never);
  });

  it('monta a config de cada serviço a partir das URLs de ambiente', () => {
    expect(service.serviceConfig()).toEqual({
      users: { url: 'http://users', timeout: 10_000 },
      products: { url: 'http://products', timeout: 10_000 },
      checkouts: { url: 'http://checkouts', timeout: 10_000 },
      payments: { url: 'http://payments', timeout: 10_000 },
    });
  });

  it('lê as URLs das chaves de ambiente esperadas', () => {
    service.serviceConfig();

    expect(configService.get).toHaveBeenCalledWith('USERS_SERVICE_URL', {
      infer: true,
    });
    expect(configService.get).toHaveBeenCalledWith('PAYMENTS_SERVICE_URL', {
      infer: true,
    });
  });
});
