import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/filters/all-exceptions.filter';
import { ProxyService } from '@/proxy/services/proxy.service';

describe('GET /api/healthz (e2e)', () => {
  let app: INestApplication<App>;
  const proxyService = { proxyRequest: vi.fn(), getServiceHealth: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProxyService)
      .useValue(proxyService)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.listen(0);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 when every service is healthy', async () => {
    proxyService.getServiceHealth.mockResolvedValue({ status: 'healthy' });

    const response = await request(app.getHttpServer())
      .get('/api/healthz')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      services: {
        users: 'healthy',
        checkouts: 'healthy',
        products: 'healthy',
        payments: 'healthy',
      },
    });
  });

  it('answers 503 naming the unhealthy service and nothing else', async () => {
    proxyService.getServiceHealth.mockImplementation(async (name: string) =>
      name === 'payments' ? { status: 'unhealthy' } : { status: 'healthy' }
    );

    const response = await request(app.getHttpServer())
      .get('/api/healthz')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      timestamp: expect.any(String),
      services: {
        users: 'healthy',
        checkouts: 'healthy',
        products: 'healthy',
        payments: 'unhealthy',
      },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /ECONNREFUSED|localhost|127\.0\.0\.1|:\d{4}/
    );
  });
});
