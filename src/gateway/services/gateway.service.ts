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
        // Its 4xx `message` is written for end users and may be shown to
        // the client. Deny by default: every other service's 4xx text stays
        // internal until that service is reviewed for it.
        forwardsClientErrors: true,
      },
      products: {
        url: this.configService.get('PRODUCTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        forwardsClientErrors: false,
      },
      checkouts: {
        url: this.configService.get('CHECKOUT_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        forwardsClientErrors: false,
      },
      payments: {
        url: this.configService.get('PAYMENTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        forwardsClientErrors: false,
      },
    } as const;

    return serviceConfig;
  }
}
