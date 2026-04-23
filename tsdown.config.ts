import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    'webpack-plugin': 'src/webpack-plugin.ts',
    'turbopack-inject': 'src/turbopack-inject.ts',
    'next-env-compat': 'src/next-env-compat.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  deps: { neverBundle: ['@dotenvx/dotenvx', '@next/env', 'next', 'webpack'] },
});
