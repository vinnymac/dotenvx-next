import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,mts}'],
    environment: 'node',
    // Reset call history between tests; keep mock implementations intact
    // (restoreMocks/mockReset would wipe the @dotenvx/dotenvx factory mock).
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.{ts,mts}', 'src/index.ts'],
    },
  },
});
