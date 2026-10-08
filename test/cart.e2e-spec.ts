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

const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const BUYER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'b@e.com',
  role: 'buyer',
};
const AUTH = { authorization: 'Bearer t' };

// Keep this file under ten requests: the global `short` throttle allows 10/s.
describe('Cart routes (e2e)', () => {
  let app: INestApplication<App>;
  const authService = { validateToken: vi.fn() };
  const proxyService = { proxyRequest: vi.fn(), getServiceHealth: vi.fn() };

  const authed = () => {
    const agent = request(app.getHttpServer());
    return {
      get: (path: string) => agent.get(path).set('Authorization', 'Bearer t'),
      post: (path: string) => agent.post(path).set('Authorization', 'Bearer t'),
      delete: (path: string) =>
        agent.delete(path).set('Authorization', 'Bearer t'),
    };
  };

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

  it('adds an item with the body as sent, extra fields included, and only the validated identity', async () => {
    const body = { productId: PRODUCT_ID, quantity: 2, price: 0 };
    proxyService.proxyRequest.mockResolvedValue({ total: 300, items: [] });

    await authed()
      .post('/api/cart/items')
      .set('x-user-id', 'forged')
      .send(body)
      .expect(201);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      { method: 'POST', path: '/cart/items', body, headers: AUTH },
      BUYER
    );
  });

  it('answers the checkout validation messages as an array', async () => {
    // A message checkout really emits (AddCartItemDto). Checkout's pipe strips
    // unknown properties rather than refusing them, so an extra `price` never
    // produces a 400 — and never sets the price either.
    const messages = ['quantity must not be greater than 99'];
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(400, 'x', undefined, messages)
    );

    const response = await authed()
      .post('/api/cart/items')
      .send({ productId: PRODUCT_ID, quantity: 100 })
      .expect(400);

    expect(response.body.message).toEqual(messages);
  });

  it('gets the active cart', async () => {
    proxyService.proxyRequest.mockResolvedValue({ total: 0, items: [] });

    const response = await authed().get('/api/cart').expect(200);

    expect(response.body).toEqual({ total: 0, items: [] });
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      { method: 'GET', path: '/cart', headers: AUTH },
      BUYER
    );
  });

  it('removes an item and answers the cart', async () => {
    proxyService.proxyRequest.mockResolvedValue({ total: 0, items: [] });

    await authed().delete(`/api/cart/items/${ITEM_ID}`).expect(200);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'checkouts',
      { method: 'DELETE', path: `/cart/items/${ITEM_ID}`, headers: AUTH },
      BUYER
    );
  });

  it("keeps the checkout 404 for an item that is not in the user's cart", async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(404, 'x', undefined, 'Cart item not found')
    );

    const response = await authed()
      .delete(`/api/cart/items/${ITEM_ID}`)
      .expect(404);

    expect(response.body.message).toBe('Cart item not found');
  });

  it('answers 400 for an item id that is not a UUID without proxying', async () => {
    await authed().delete('/api/cart/items/abc').expect(400);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('refuses a request without a token before reaching the checkout', async () => {
    await request(app.getHttpServer()).get('/api/cart').expect(401);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('answers 502 without details when the checkout fails', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(503, 'Downstream request failed with status 503')
    );

    const response = await authed().get('/api/cart').expect(502);

    expect(response.body.message).toBe('Upstream service request failed');
  });
});
