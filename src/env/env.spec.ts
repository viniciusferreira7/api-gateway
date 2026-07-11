import { describe, expect, it } from 'vitest';
import { envSchema } from './env';

const baseEnv = {
  JWT_SECRET: 'secret',
  USERS_SERVICE_URL: 'http://users',
  PRODUCTS_SERVICE_URL: 'http://products',
  CHECKOUT_SERVICE_URL: 'http://checkouts',
  PAYMENTS_SERVICE_URL: 'http://payments',
  CORS_ORIGIN: '*',
  RATE_TTL_SHORT: '1000',
  RATE_LIMIT_SHORT: '3',
  RATE_TTL_MEDIUM: '10000',
  RATE_LIMIT_MEDIUM: '20',
  RATE_TTL_LONG: '60000',
  RATE_LIMIT_LONG: '100',
};

describe('envSchema', () => {
  it('aplica os defaults de NODE_ENV e PORT', () => {
    const env = envSchema.parse(baseEnv);

    expect(env.NODE_ENV).toBe('dev');
    expect(env.PORT).toBe(3333);
  });

  it('aceita CORS_ORIGIN curinga', () => {
    expect(envSchema.parse(baseEnv).CORS_ORIGIN).toBe('*');
  });

  it('transforma CORS_ORIGIN em lista de URLs', () => {
    const env = envSchema.parse({
      ...baseEnv,
      CORS_ORIGIN: 'http://a.com, http://b.com',
    });

    expect(env.CORS_ORIGIN).toEqual(['http://a.com', 'http://b.com']);
  });

  it('interpreta números com separador underscore', () => {
    const env = envSchema.parse({ ...baseEnv, RATE_LIMIT_LONG: '1_000' });

    expect(env.RATE_LIMIT_LONG).toBe(1000);
  });

  it('rejeita URL de serviço inválida', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, USERS_SERVICE_URL: 'not-a-url' })
    ).toThrow();
  });

  it('rejeita JWT_SECRET vazio', () => {
    expect(() => envSchema.parse({ ...baseEnv, JWT_SECRET: '' })).toThrow();
  });
});
