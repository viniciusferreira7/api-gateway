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
const AUTH = { authorization: 'Bearer t' };

// Keep this file under ten requests: the global `short` throttle allows 10/s.
describe('Checkout and orders routes (e2e)', () => {
  let app: INestApplication<App>;
  const authService = { validateToken: vi.fn() };
  const proxyService = { proxyRequest: vi.fn(), getServiceHealth: vi.fn() };

  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer t');
  const post = (path: string) =>
    request(app.getHttpServer()).post(path).set('Authorization', 'Bearer t');

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

  it('checks out with the body as sent and answers 201', async () => {
    proxyService.proxyRequest.mockResolvedValue({
      id: ORDER_ID,
      status: 'pending',
    });

    const response = await post('/api/cart/checkout')
      .set('x-user-id', 'forged')
      .send({ paymentMethod: 'pix' })
      .expect(201);

    expect(response.body).toEqual({ id: ORDER_ID, status: 'pending' });
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      {
        method: 'POST',
        path: '/cart/checkout',
        body: { paymentMethod: 'pix' },
        headers: AUTH,
      },
      BUYER
    );
  });

  it('answers the checkout 400 for an empty cart with its message', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(400, 'x', undefined, 'Cart is empty')
    );

    const response = await post('/api/cart/checkout')
      .send({ paymentMethod: 'pix' })
      .expect(400);

    expect(response.body.message).toBe('Cart is empty');
  });

  it("lists the user's orders", async () => {
    proxyService.proxyRequest.mockResolvedValue([{ id: ORDER_ID }]);

    await get('/api/orders').expect(200);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      { method: 'GET', path: '/orders', headers: AUTH },
      BUYER
    );
  });

  it('gets one order by id', async () => {
    proxyService.proxyRequest.mockResolvedValue({ id: ORDER_ID });

    await get(`/api/orders/${ORDER_ID}`).expect(200);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      { method: 'GET', path: `/orders/${ORDER_ID}`, headers: AUTH },
      BUYER
    );
  });

  it("keeps the checkout 404 for an order that is not the user's", async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(404, 'x', undefined, 'Order not found')
    );

    const response = await get(`/api/orders/${ORDER_ID}`).expect(404);

    expect(response.body.message).toBe('Order not found');
  });

  it('answers 400 for an order id that is not a UUID without proxying', async () => {
    await get('/api/orders/abc').expect(400);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('refuses a checkout without a token before reaching the checkout', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/checkout')
      .send({ paymentMethod: 'pix' })
      .expect(401);
    await request(app.getHttpServer()).get('/api/orders').expect(401);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });
});
