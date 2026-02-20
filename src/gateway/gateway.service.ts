import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '@/env/env';

@Injectable()
export class GatewayService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  public serviceConfig() {
    const serviceConfig = {
      users: {
        url: this.configService.get('USERS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
      },
      products: {
        url: this.configService.get('PRODUCTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
      },
      checkout: {
        url: this.configService.get('CHECKOUT_SERVICE_URL', { infer: true }),
        timeout: 10_000,
      },
      payments: {
        url: this.configService.get('PAYMENTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
      },
    } as const;

    return serviceConfig;
  }
}
