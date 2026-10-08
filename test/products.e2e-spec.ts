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

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const SELLER = { id: SELLER_ID, email: 's@e.com', role: 'seller' };

// Keep this file under ten requests: the global `short` throttle allows 10/s.
describe('Products routes (e2e)', () => {
  let app: INestApplication<App>;
  const authService = { validateToken: vi.fn() };
  const proxyService = { proxyRequest: vi.fn(), getServiceHealth: vi.fn() };

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
      userId: SELLER.id,
      email: SELLER.email,
      role: SELLER.role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the catalog without a token and without forwarding one', async () => {
    proxyService.proxyRequest.mockResolvedValue([{ id: PRODUCT_ID }]);

    const response = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', 'Bearer t')
      .expect(200);

    expect(response.body).toEqual([{ id: PRODUCT_ID }]);
    expect(proxyService.proxyRequest).toHaveBeenCalledWith('products', {
      method: 'GET',
      path: '/products',
    });
    expect(authService.validateToken).not.toHaveBeenCalled();
  });

  it("lists a seller's products by seller id", async () => {
    proxyService.proxyRequest.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get(`/api/products/seller/${SELLER_ID}`)
      .expect(200);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith('products', {
      method: 'GET',
      path: `/products/seller/${SELLER_ID}`,
    });
  });

  it('gets a product by id', async () => {
    proxyService.proxyRequest.mockResolvedValue({ id: PRODUCT_ID });

    await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}`)
      .expect(200);

    expect(proxyService.proxyRequest).toHaveBeenCalledWith('products', {
      method: 'GET',
      path: `/products/${PRODUCT_ID}`,
    });
  });

  it('answers 400 for an id that is not a UUID without proxying', async () => {
    await request(app.getHttpServer()).get('/api/products/abc').expect(400);
    await request(app.getHttpServer())
      .get('/api/products/seller/abc')
      .expect(400);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('keeps the products service 404 and its message', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(404, 'x', undefined, 'Product not found')
    );

    const response = await request(app.getHttpServer())
      .get(`/api/products/${PRODUCT_ID}`)
      .expect(404);

    expect(response.body.message).toBe('Product not found');
  });

  it('creates a product with the body as sent and the validated user', async () => {
    const body = { name: 'Teclado', description: 'd', price: 150, stock: 10 };
    proxyService.proxyRequest.mockResolvedValue({ id: PRODUCT_ID, ...body });

    const response = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', 'Bearer t')
      .set('x-user-id', 'forged')
      .send(body)
      .expect(201);

    expect(response.body.id).toBe(PRODUCT_ID);
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'products',
      {
        method: 'POST',
        path: '/products',
        body,
        headers: { authorization: 'Bearer t' },
      },
      SELLER
    );
  });

  it('refuses to create without a token before reaching the products service', async () => {
    await request(app.getHttpServer())
      .post('/api/products')
      .send({ name: 'x' })
      .expect(401);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });
});
