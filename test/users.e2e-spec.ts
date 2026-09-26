import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
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

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

// Keep this file under ten requests: the global `short` throttle allows 10/s.
describe('Users routes (e2e)', () => {
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
      userId: '1',
      email: 'a@b.com',
      role: 'seller',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('proxies the profile with the validated user', async () => {
    proxyService.proxyRequest.mockResolvedValue({ id: '1' });

    const response = await get('/api/users/profile').expect(200);

    expect(response.body).toEqual({ id: '1' });
    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'users',
      {
        method: 'GET',
        path: '/users/profile',
        headers: { authorization: 'Bearer t' },
      },
      { id: '1', email: 'a@b.com', role: 'seller' }
    );
  });

  it('refuses a request without a token before reaching the users service', async () => {
    await request(app.getHttpServer()).get('/api/users/sellers').expect(401);

    expect(authService.validateToken).not.toHaveBeenCalled();
    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('refuses a token the users service rejects', async () => {
    authService.validateToken.mockRejectedValue(new UnauthorizedException());

    await get('/api/users/sellers').expect(401);
    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('answers 400 for an id that is not a UUID without proxying', async () => {
    await get('/api/users/not-a-uuid').expect(400);

    expect(proxyService.proxyRequest).not.toHaveBeenCalled();
  });

  it('keeps the users service 404 for an unknown id', async () => {
    proxyService.proxyRequest.mockRejectedValue(
      new HttpRequestError(404, 'Downstream request failed with status 404')
    );

    const response = await get(`/api/users/${UNKNOWN_ID}`).expect(404);

    expect(response.body.message).toBe('Upstream service request failed');
  });
});
