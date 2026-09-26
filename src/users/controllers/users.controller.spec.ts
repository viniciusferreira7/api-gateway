import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';

const user = { id: '1', email: 'a@b.com', role: 'seller' };
const request = { headers: { authorization: 'Bearer t' }, user };

describe('UsersController', () => {
  let controller: UsersController;
  let proxyService: { proxyRequest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    proxyService = { proxyRequest: vi.fn().mockResolvedValue({ ok: true }) };
    controller = new UsersController(proxyService as never);
  });

  it.each([
    ['getProfile', () => controller.getProfile(request), '/users/profile'],
    ['listSellers', () => controller.listSellers(request), '/users/sellers'],
    [
      'getById',
      () => controller.getById('11111111-1111-4111-8111-111111111111', request),
      '/users/11111111-1111-4111-8111-111111111111',
    ],
  ])('%s forwards the token and the validated user to the users service', async (_, call, path) => {
    await expect(call()).resolves.toEqual({ ok: true });

    expect(proxyService.proxyRequest).toHaveBeenCalledWith(
      'users',
      { method: 'GET', path, headers: { authorization: 'Bearer t' } },
      user
    );
  });
});
