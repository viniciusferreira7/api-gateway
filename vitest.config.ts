import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Desliga o transform padrão (oxc) do Vitest 4 para que o SWC — configurado
  // abaixo com decoratorMetadata — seja o transformador autoritativo dos .ts.
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    root: './',
  },
  plugins: [
    tsconfigPaths(),
    // SWC handles NestJS decorators + `emitDecoratorMetadata` (esbuild does not).
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
