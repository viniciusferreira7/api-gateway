import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: z.coerce.number().default(3333),

  JWT_SECRET: z.string().min(1),

  USERS_SERVICE_URL: z.url(),
  PRODUCTS_SERVICE_URL: z.url(),
  CHECKOUT_SERVICE_URL: z.url(),
  PAYMENTS_SERVICE_URL: z.url(),

  CORS_ORIGIN: z.union([
    z.literal('*'),
    z
      .string()
      .transform((val) => val.split(',').map((url) => url.trim()))
      .pipe(z.array(z.url())),
  ]),
});

export type Env = z.infer<typeof envSchema>;
