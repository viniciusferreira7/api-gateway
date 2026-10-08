import { beforeAll, describe, expect, it } from 'vitest';
import { assertMarketplaceUp, call } from './marketplace-client';

/**
 * The whole marketplace, through the gateway, against the real services.
 *
 * Needs users, products, checkout, payments, RabbitMQ and their databases up,
 * with one JWT_SECRET shared by users, products, checkout and payments — see
 * README, "Teste de sistema".
 *
 * One run registers 2 users and logs in twice. The gateway allows 3 registers
 * and 5 logins per minute per IP, so a second run within a minute may get 429.
 */
describe('Marketplace (system)', () => {
  beforeAll(async () => {
    await assertMarketplaceUp();
  });

  it('reaches the gateway', async () => {
    const { status } = await call('GET', '/readyz');

    expect(status).toBe(200);
  });
});
