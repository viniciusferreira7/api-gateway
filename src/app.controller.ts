import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProxyService } from './proxy/proxy.service';

@ApiTags('Health')
@Controller('api')
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

  @Get('/healthz')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'All downstream services are healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        users: { status: 'SERVING' },
        checkouts: { status: 'SERVING' },
        products: { status: 'SERVING' },
        payments: { status: 'SERVING' },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more downstream services are unavailable',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected error during health check',
  })
  async getHealth() {
    const [users, checkouts, products, payments] = await Promise.all([
      this.proxyService.getServiceHealth('users'),
      this.proxyService.getServiceHealth('checkouts'),
      this.proxyService.getServiceHealth('products'),
      this.proxyService.getServiceHealth('payments'),
    ]);

    const status =
      !users.error && !checkouts.error && !products.error && !payments.error
        ? 'ok'
        : 'error';

    if (status === 'error') {
      return new ServiceUnavailableException({
        status,
        timestamp: new Date().toISOString(),
        users,
        checkouts,
        products,
        payments,
      });
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      users,
      checkouts,
      products,
      payments,
    };
  }
}
