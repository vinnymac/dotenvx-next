import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@dotenvx/dotenvx', () => ({
  default: { config: vi.fn(() => ({ parsed: {} })) },
}));

describe('next-env-compat', () => {
  it('decrypts via dotenvx on each loadEnvConfig call, not at import time', async () => {
    const dotenvx = (await import('@dotenvx/dotenvx')).default;
    const mod = await import('./next-env-compat.js');

    // Importing the module must not trigger decryption on its own.
    expect(dotenvx.config).toHaveBeenCalledTimes(0);

    mod.loadEnvConfig(tmpdir(), true);

    expect(dotenvx.config).toHaveBeenCalledWith({ quiet: true });
  });

  it('re-exports the @next/env API surface for use as an npm-overrides shim', async () => {
    const mod = await import('./next-env-compat.js');

    expect(typeof mod.loadEnvConfig).toBe('function');
    expect(typeof mod.updateInitialEnv).toBe('function');
    expect(typeof mod.processEnv).toBe('function');
    expect(typeof mod.resetEnv).toBe('function');
    expect('initialEnv' in mod).toBe(true);
  });
});
