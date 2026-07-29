import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { envSchema } from '@/env/env';
import { HttpModule } from '@/http/http.module';
import {
  HttpClientService,
  HttpRequestError,
} from '@/http/services/http-client.service';

type Handler = (request: IncomingMessage) => {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

describe('HttpClientService (integration)', () => {
  let server: Server;
  let handler: Handler;
  let httpClient: HttpClientService;
  const requests: Array<{ method?: string; url?: string }> = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push({ method: request.method, url: request.url });

      const { status, body, headers } = handler(request);

      response.writeHead(status, {
        'content-type': 'application/json',
        ...headers,
      });
      response.end(body === undefined ? '' : JSON.stringify(body));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const { port } = server.address() as AddressInfo;
    process.env.USERS_SERVICE_URL = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(async () => {
    requests.length = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (env) => envSchema.parse(env),
        }),
        HttpModule,
      ],
    }).compile();

    httpClient = moduleRef.get(HttpClientService);
  });

  it('resolves the downstream JSON body through the wired module graph', async () => {
    handler = () => ({ status: 200, body: { id: 'user-1' } });

    const result = await httpClient.request('users', {
      method: 'GET',
      path: '/users/user-1',
    });

    expect(result).toEqual({ id: 'user-1' });
    expect(requests).toEqual([{ method: 'GET', url: '/users/user-1' }]);
  });

  it('retries an idempotent request until the downstream recovers', async () => {
    let calls = 0;
    handler = () => {
      calls += 1;
      return calls === 1
        ? { status: 503 }
        : { status: 200, body: { status: 'ok' } };
    };

    const result = await httpClient.request('users', {
      method: 'GET',
      path: '/healthz',
    });

    expect(result).toEqual({ status: 'ok' });
    expect(requests).toHaveLength(2);
  });

  it('does not retry a non-idempotent request', async () => {
    handler = () => ({ status: 503 });

    await expect(
      httpClient.request('users', { method: 'POST', path: '/users' })
    ).rejects.toThrow(HttpRequestError);

    expect(requests).toHaveLength(1);
  });

  it('surfaces a non-retryable status without retrying', async () => {
    handler = () => ({ status: 400, body: { message: 'invalid' } });

    await expect(
      httpClient.request('users', { method: 'GET', path: '/users/none' })
    ).rejects.toMatchObject({ status: 400 });

    expect(requests).toHaveLength(1);
  });
});
