/**
 * Environment defaults for the lanes that boot the Nest application
 * (integration and e2e). `.env.test` is gitignored, so without this a fresh
 * clone or a CI run would fail the Zod validation in `src/env/env.ts`.
 *
 * These are throwaway values — never put real credentials here. Anything
 * already present in `process.env` wins, so CI can override any of them.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3333',
  JWT_SECRET: 'test-secret',
  USERS_SERVICE_URL: 'http://localhost:3001',
  PRODUCTS_SERVICE_URL: 'http://localhost:3002',
  CHECKOUT_SERVICE_URL: 'http://localhost:3003',
  PAYMENTS_SERVICE_URL: 'http://localhost:3004',
  CORS_ORIGIN: '*',
  RATE_TTL_SHORT: '1_000',
  RATE_LIMIT_SHORT: '10',
  RATE_TTL_MEDIUM: '60_000',
  RATE_LIMIT_MEDIUM: '100',
  RATE_TTL_LONG: '900_000',
  RATE_LIMIT_LONG: '1_000',
  // `NODE_ENV=test` disables the signals SDK, so nothing is exported. These
  // only exist to satisfy the Zod schema.
  OTEL_SERVICE_NAME: 'api-gateway',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
