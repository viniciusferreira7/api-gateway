import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggingMiddleware } from './logging.middleware';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let handlers: Record<string, (...args: unknown[]) => void>;

  function makeRequest(): Request {
    return {
      method: 'GET',
      originalUrl: '/x',
      ip: '1.2.3.4',
      get: vi.fn().mockReturnValue('UA'),
      on: vi.fn(),
    } as never;
  }

  function makeResponse(statusCode: number): Response {
    handlers = {};
    return {
      statusCode,
      get: vi.fn().mockReturnValue('123'),
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = cb;
      }),
    } as never;
  }

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    logSpy = vi
      .spyOn(middleware['logger'], 'log')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(middleware['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  it('loga a request de entrada e chama next', () => {
    const next = vi.fn() as unknown as NextFunction;

    middleware.use(makeRequest(), makeResponse(200), next);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Incoming Request: GET /x')
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('loga a response de saída ao finalizar', () => {
    const res = makeResponse(200);

    middleware.use(makeRequest(), res, vi.fn() as never);
    handlers.finish();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Outgoing Response: GET /x - 200')
    );
  });

  it('loga erro quando o status é >= 400', () => {
    const res = makeResponse(500);

    middleware.use(makeRequest(), res, vi.fn() as never);
    handlers.finish();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error response: GET /x - 500')
    );
  });
});
