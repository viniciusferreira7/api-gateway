import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProxyService } from './proxy/services/proxy.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('/readyz')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Gateway is ready',
    schema: {
      example: { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' },
    },
  })
  async getReady() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 503 when any downstream service is unhealthy, so load balancers and the
   * system test can trust the status code. The body names services and their
   * verdict only.
   */
  @Get('/healthz')
  @ApiOkResponse({
    description: 'All downstream services are healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-10-08T00:00:00.000Z',
        services: {
          users: 'healthy',
          checkouts: 'healthy',
          products: 'healthy',
          payments: 'healthy',
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'At least one downstream service is unhealthy',
  })
  async getHealth(
    @Res({ passthrough: true }) reply: { status: (code: number) => unknown }
  ) {
    const names = ['users', 'checkouts', 'products', 'payments'] as const;
    const verdicts = await Promise.all(
      names.map((name) => this.proxyService.getServiceHealth(name))
    );
    const services = Object.fromEntries(
      names.map((name, index) => [name, verdicts[index].status])
    ) as Record<(typeof names)[number], 'healthy' | 'unhealthy'>;
    const healthy = verdicts.every(({ status }) => status === 'healthy');

    if (!healthy) {
      reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
