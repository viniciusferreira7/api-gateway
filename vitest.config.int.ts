import { mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.shared';

/**
 * Integration lane: `*.int-spec.ts`.
 *
 * Wires multiple modules through the DI container without crossing the HTTP
 * boundary. Runs serially with generous timeouts.
 */
export default mergeConfig(baseConfig, {
  test: {
    include: ['**/*.int-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 100_000,
    hookTimeout: 100_000,
  },
});
