import { defineConfig } from 'tsdown';

export default defineConfig([
  // next-env-compat is the @next/env replacement that runs at both build time AND runtime.
  // On Vercel, the bundled server inlines @next/env so its dependencies are not traced
  // into the serverless function. Bundle @dotenvx/dotenvx directly to avoid runtime
  // "Cannot find module" errors.
  {
    entry: { 'next-env-compat': 'src/next-env-compat.ts' },
    deps: { alwaysBundle: ['@dotenvx/dotenvx'], onlyBundle: false },
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    treeshake: true,
    clean: true,
    outDir: 'dist',
    splitting: false,
  },
  // Other entry points only run at build time where @dotenvx/dotenvx is always available.
  // Dual ESM+CJS output.
  {
    entry: {
      index: 'src/index.ts',
      plugin: 'src/plugin.ts',
      init: 'src/init.ts',
      'webpack-plugin': 'src/webpack-plugin.ts',
      'turbopack-inject': 'src/turbopack-inject.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    treeshake: true,
    clean: false, // first config already cleaned
    outDir: 'dist',
    splitting: false,
    deps: { neverBundle: ['@dotenvx/dotenvx', 'next', 'webpack'] },
  },
]);
