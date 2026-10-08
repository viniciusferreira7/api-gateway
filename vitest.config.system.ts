import { mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.shared';

/**
 * System lane: `test/system/**\/*.system-spec.ts`.
 *
 * Drives the real marketplace through the running gateway — no Nest boot, no
 * mocks. Every service must already be up (see README, "System test").
 * Serial: the steps share state and the gateway throttles per IP.
 */
export default mergeConfig(baseConfig, {
  test: {
    include: ['test/system/**/*.system-spec.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
