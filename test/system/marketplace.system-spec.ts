import { beforeAll, describe, expect, it } from 'vitest';
import {
  assertMarketplaceUp,
  call,
  waitForPayment,
} from './marketplace-client';

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
  const run = Date.now();
  const password = 'Senha-forte-123';
  const seller = { email: `seller+${run}@e2e.test`, token: '', id: '' };
  const buyer = { email: `buyer+${run}@e2e.test`, token: '', id: '' };
  const products = { keyboard: '', mouse: '' };
  let approvedOrderId = '';

  beforeAll(async () => {
    await assertMarketplaceUp();
  });

  it('1. registers a seller and a buyer and logs both in', async () => {
    for (const [user, role] of [
      [seller, 'seller'],
      [buyer, 'buyer'],
    ] as const) {
      const registered = await call('POST', '/auth/register', {
        body: {
          email: user.email,
          password,
          firstName: 'E2E',
          lastName: role === 'seller' ? 'Seller' : 'Buyer',
          role,
        },
      });
      expect(registered.status).toBe(201);
      user.id = registered.body.id;

      const login = await call('POST', '/auth/login', {
        body: { email: user.email, password },
      });
      expect(login.status).toBe(200);
      expect(login.body.token).toEqual(expect.any(String));
      user.token = login.body.token;
    }
  });

  it('2. lets the seller create products and refuses the buyer', async () => {
    const keyboard = await call('POST', '/products', {
      token: seller.token,
      body: {
        name: `Teclado ${run}`,
        description: 'Mecânico, 75%',
        price: 150,
        stock: 10,
      },
    });
    expect(keyboard.status).toBe(201);
    expect(keyboard.body).toMatchObject({ price: 150, sellerId: seller.id });
    products.keyboard = keyboard.body.id;

    const mouse = await call('POST', '/products', {
      token: seller.token,
      body: {
        name: `Mouse ${run}`,
        description: 'Sem fio',
        price: 49.99,
        stock: 10,
      },
    });
    expect(mouse.status).toBe(201);
    products.mouse = mouse.body.id;

    const refused = await call('POST', '/products', {
      token: buyer.token,
      body: { name: 'x', description: 'x', price: 1, stock: 1 },
    });
    expect(refused.status).toBe(403);
  });

  it('3. shows the products in the public catalog', async () => {
    const catalog = await call('GET', '/products');
    expect(catalog.status).toBe(200);
    const ids = catalog.body.map((product: { id: string }) => product.id);
    expect(ids).toEqual(
      expect.arrayContaining([products.keyboard, products.mouse])
    );

    const keyboard = await call('GET', `/products/${products.keyboard}`);
    expect(keyboard.status).toBe(200);
    expect(keyboard.body).toMatchObject({
      name: `Teclado ${run}`,
      price: 150,
    });
  });

  it('4. adds two keyboards to the cart', async () => {
    const added = await call('POST', '/cart/items', {
      token: buyer.token,
      body: { productId: products.keyboard, quantity: 2 },
    });
    expect(added.status).toBe(201);

    const cart = await call('GET', '/cart', { token: buyer.token });
    expect(cart.status).toBe(200);
    expect(cart.body.total).toBe(300);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0]).toMatchObject({
      productId: products.keyboard,
      quantity: 2,
      subtotal: 300,
    });
  });

  it('5. checks out into a pending order and empties the cart', async () => {
    const order = await call('POST', '/cart/checkout', {
      token: buyer.token,
      body: { paymentMethod: 'credit_card' },
    });
    expect(order.status).toBe(201);
    expect(order.body).toMatchObject({
      status: 'pending',
      total: 300,
      paymentMethod: 'credit_card',
    });
    approvedOrderId = order.body.id;

    const cart = await call('GET', '/cart', { token: buyer.token });
    expect(cart.body.items).toEqual([]);
  });

  it('6. lists the order and shows it', async () => {
    const orders = await call('GET', '/orders', { token: buyer.token });
    expect(orders.status).toBe(200);
    expect(orders.body.map((order: { id: string }) => order.id)).toContain(
      approvedOrderId
    );

    const order = await call('GET', `/orders/${approvedOrderId}`, {
      token: buyer.token,
    });
    expect(order.status).toBe(200);
    expect(order.body).toMatchObject({ id: approvedOrderId, total: 300 });
  });

  it('7. approves the 300.00 payment', async () => {
    const payment = await waitForPayment(approvedOrderId, buyer.token);

    expect(payment).toMatchObject({
      orderId: approvedOrderId,
      status: 'approved',
      amount: 300,
      rejectionReason: null,
    });
    expect(payment.transactionId).toMatch(/^fake_/);
  });

  it('8. rejects the 49.99 payment as declined by the issuer', async () => {
    const added = await call('POST', '/cart/items', {
      token: buyer.token,
      body: { productId: products.mouse, quantity: 1 },
    });
    expect(added.status).toBe(201);

    const order = await call('POST', '/cart/checkout', {
      token: buyer.token,
      body: { paymentMethod: 'pix' },
    });
    expect(order.status).toBe(201);
    expect(order.body.total).toBe(49.99);

    const payment = await waitForPayment(order.body.id, buyer.token);

    expect(payment).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Cartão recusado pela operadora',
    });
  });

  it("9. hides the buyer's order and payment from the seller", async () => {
    const order = await call('GET', `/orders/${approvedOrderId}`, {
      token: seller.token,
    });
    expect(order.status).toBe(404);

    const payment = await call('GET', `/payments/${approvedOrderId}`, {
      token: seller.token,
    });
    expect(payment.status).toBe(404);
    expect(payment.body.message).toBe('Payment not found');
  });
});
