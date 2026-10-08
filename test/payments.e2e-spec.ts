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
import { AuthService } from '@/auth/services/auth.service';
import { AllExceptionsFilter } from '@/filters/all-exceptions.filter';
import { HttpRequestError } from '@/http/services/http-client.service';
import { ProxyService } from '@/proxy/services/proxy.service';

const ORDER_ID = '55555555-5555-4555-8555-555555555555';
const BUYER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'b@e.com',
  role: 'buyer',
};

// Keep this file under ten requests: the global `short` throttle allows 10/s.
describe('Payments routes (e2e)', () => {
  let app: INestApplication<App>;
  const authService = { validateToken: vi.fn() };
  const proxyService = { proxyRequest: vi.fn(), getServiceHealth: vi.fn() };

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer t');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(authService)
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
    authService.validateToken.mockResolvedValue({
      userId: BUYER.id,
      email: BUYER.email,
      role: BUYER.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("proxies the order's payment with only the validated identity", async () => {
    proxyService.proxyRequest.mockResolvedValue({
      orderId: ORDER_ID,
      status: 'approved',
    });

    const response = await get(`/api/payments/${ORDER_ID}`)
      .set('x-user-id', 'forged')
      .expect(200);

    expect(response.body).toEqual({ orderId: ORDER_ID, status: 'approved' });
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'payments',
      {
        method: 'GET',
        path: `/payments/${ORDER_ID}`,
        headers: { authorization: 'Bearer t' },
      },
      BUYER
    );
  });

  it("keeps the payments 404 for an order that is not the user's", async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(404, 'x', undefined, 'Payment not found')
    );

    const response = await get(`/api/payments/${ORDER_ID}`).expect(404);

    expect(response.body.message).toBe('Payment not found');
  });

  it('answers 400 for an order id that is not a UUID without proxying', async () => {
    await get('/api/payments/abc').expect(400);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('refuses a request without a token before reaching the payments service', async () => {
    await request(app.getHttpServer())
      .get(`/api/payments/${ORDER_ID}`)
      .expect(401);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });
});
