import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * Base Vitest config shared by the unit, integration and e2e runners.
 *
 * Each runner merges this and overrides only its include glob, parallelism and
 * timeouts. Vitest 4's default `oxc` transform is disabled so SWC owns the
 * `.ts` transformation and keeps `emitDecoratorMetadata` working for NestJS DI.
 */
export const baseConfig = defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    root: './',
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
