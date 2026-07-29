import { mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.shared';

/**
 * End-to-end lane: `*.e2e-spec.ts`.
 *
 * Boots the full Nest application and drives it over HTTP. Serial, with long
 * timeouts.
 */
export default mergeConfig(baseConfig, {
  test: {
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 1_000_000,
    hookTimeout: 1_000_000,
  },
});
