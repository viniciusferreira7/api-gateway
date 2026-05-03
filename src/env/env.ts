import { z } from 'zod';

const numberFromEnv = z
  .string()
  .transform((val) => Number(val.replace(/_/g, '')))
  .pipe(z.number());

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: z.coerce.number().default(3333),

  JWT_SECRET: z.string().min(1),

  USERS_SERVICE_URL: z.string().min(1),
  PRODUCTS_SERVICE_URL: z.string().min(1),
  CHECKOUT_SERVICE_URL: z.string().min(1),
  PAYMENTS_SERVICE_URL: z.string().min(1),

  CORS_ORIGIN: z.union([
    z.literal('*'),
    z
      .string()
      .transform((val) => val.split(',').map((url) => url.trim()))
      .pipe(z.array(z.url())),
  ]),

  RATE_TTL_SHORT: numberFromEnv,
  RATE_LIMIT_SHORT: numberFromEnv,

  RATE_TTL_MEDIUM: numberFromEnv,
  RATE_LIMIT_MEDIUM: numberFromEnv,

  RATE_TTL_LONG: numberFromEnv,
  RATE_LIMIT_LONG: numberFromEnv,
});

export type Env = z.infer<typeof envSchema>;
