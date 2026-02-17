import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z
    .string()
    .transform((val) => val.split(',').map((url) => url.trim()))
    .pipe(z.array(z.url())),
});

export type Env = z.infer<typeof envSchema>;
