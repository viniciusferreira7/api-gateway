import { Controller, Get } from '@nestjs/common';
import { ProxyService } from './proxy/proxy.service';

@Controller('api')
export class AppController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('/readyz')
  async getReady() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('/healthz')
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

    return {
      status,
      timestamp: new Date().toISOString(),
      users,
      checkouts,
      products,
      payments,
    };
  }

  //TODO: 18:40
}
