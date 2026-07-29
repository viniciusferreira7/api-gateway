import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProxyService } from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let httpClient: { request: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClient = { request: vi.fn() };
    service = new ProxyService(httpClient as never);
    vi.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    vi.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  describe('proxyRequest', () => {
    it('deriva os headers x-user-* do userInfo autenticado', async () => {
      httpClient.request.mockResolvedValue({ ok: true });

      await service.proxyRequest(
        'users' as never,
        { method: 'GET', path: '/me', headers: { authorization: 'Bearer t' } },
        { id: '1', email: 'a@b.com', role: 'admin' }
      );

      expect(httpClient.request).toHaveBeenCalledWith('users', {
        method: 'GET',
        path: '/me',
        headers: {
          authorization: 'Bearer t',
          'x-user-id': '1',
          'x-user-email': 'a@b.com',
          'x-user-role': 'admin',
        },
      });
    });

    it('nunca encaminha headers de identidade vindos do cliente', async () => {
      httpClient.request.mockResolvedValue({ ok: true });

      await service.proxyRequest('users' as never, {
        method: 'GET',
        path: '/me',
        headers: {
          authorization: 'Bearer t',
          'x-user-id': 'forjado',
          'x-user-role': 'admin',
        } as never,
      });

      expect(httpClient.request).toHaveBeenCalledWith('users', {
        method: 'GET',
        path: '/me',
        headers: { authorization: 'Bearer t' },
      });
    });

    it('propaga o erro do httpClient', async () => {
      const error = new Error('down');
      httpClient.request.mockRejectedValue(error);

      await expect(
        service.proxyRequest('users' as never, { method: 'GET', path: '/me' })
      ).rejects.toBe(error);
    });
  });

  describe('getServiceHealth', () => {
    it('retorna healthy quando o healthz responde', async () => {
      httpClient.request.mockResolvedValue(undefined);

      await expect(service.getServiceHealth('users' as never)).resolves.toEqual(
        { status: 'healthy' }
      );
    });

    it('retorna unhealthy com a mensagem de erro quando falha', async () => {
      httpClient.request.mockRejectedValue(new Error('timeout'));

      await expect(service.getServiceHealth('users' as never)).resolves.toEqual(
        { status: 'unhealthy', error: 'timeout' }
      );
    });
  });
});
