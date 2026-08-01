import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/filters/all-exceptions.filter';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirrors main.ts: without it the e2e lane never exercises the real error
    // contract the application serves.
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/readyz reports the gateway as ready', async () => {
    const response = await request(app.getHttpServer()).get('/api/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
  });

  it('returns 404 for an unknown route', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      path: '/api/unknown',
    });
  });

  it('throttles a burst of requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app.getHttpServer()).get('/api/readyz')
      )
    );

    expect(responses.some((response) => response.status === 429)).toBe(true);
  });
});
