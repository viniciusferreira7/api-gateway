import { mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.shared';

/**
 * Unit lane: `*.unit-spec.ts`.
 *
 * Pure and isolated — no NestApplication boot, no external infra. This is the
 * default config, so `vitest run` and `pnpm test:unit` run this lane.
 */
export default mergeConfig(baseConfig, {
  test: {
    include: ['**/*.unit-spec.ts'],
  },
});
