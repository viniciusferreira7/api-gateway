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
        // A service's 4xx `message` may reach the client only after every 4xx
        // it emits was reviewed and found to describe the caller's own
        // request: no ids, hosts or names of other services. Deny by default.
        forwardsClientErrors: true,
      },
      products: {
        url: this.configService.get('PRODUCTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        // Reviewed: "Product not found", Unauthorized, Forbidden and the
        // ValidationPipe arrays built from the caller's own body.
        forwardsClientErrors: true,
      },
      checkouts: {
        url: this.configService.get('CHECKOUT_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        // Reviewed: "Product not found", "Not enough stock", "Cart total
        // exceeds the maximum", "Cart item not found", "Cart is empty",
        // "Order not found", Unauthorized and the ValidationPipe arrays.
        forwardsClientErrors: true,
      },
      payments: {
        url: this.configService.get('PAYMENTS_SERVICE_URL', { infer: true }),
        timeout: 10_000,
        // Reviewed: "Payment not found", Unauthorized and the ValidationPipe
        // arrays.
        forwardsClientErrors: true,
      },
    } as const;

    return serviceConfig;
  }
}
