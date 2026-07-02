import type { NextConfig } from 'next';
import dotenvx from '@dotenvx/dotenvx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activateTurbopackInjection } from './turbopack-inject.js';
import { DotenvxWebpackPlugin } from './webpack-plugin.js';

vi.mock('@dotenvx/dotenvx', () => ({
  default: { config: vi.fn(() => ({ parsed: {} })) },
}));

// Pretend every resolved env file exists so the dotenvx.config() branch runs.
vi.mock('node:fs', () => ({
  default: { existsSync: () => true },
  existsSync: () => true,
}));

const configMock = vi.mocked(dotenvx.config);

vi.mock('./turbopack-inject.js', () => ({
  activateTurbopackInjection: vi.fn(),
}));

// Turbopack is detected via these env vars; clear them so the webpack branch
// runs (and so we never patch the test process's global `fs`).
const TURBOPACK_ENV = [
  'TURBOPACK',
  'TURBOPACK_DEV',
  'TURBOPACK_BUILD',
  'npm_config_turbopack',
];

type WebpackFn = (
  config: { plugins: unknown[]; resolve: Record<string, unknown> },
  options: unknown
) => { plugins: unknown[]; resolve: { alias: Record<string, string> } };

describe('withDotenvx (webpack wiring)', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    configMock.mockClear();
    for (const key of TURBOPACK_ENV) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TURBOPACK_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('returns a config function', async () => {
    const { withDotenvx } = await import('./plugin.js');
    expect(typeof withDotenvx({})).toBe('function');
  });

  it('registers the webpack plugin and preserves the user webpack config', async () => {
    const { withDotenvx } = await import('./plugin.js');
    const userWebpack = vi.fn((config: { plugins: unknown[] }) => config);

    const configFn = withDotenvx({
      webpack: userWebpack,
    } as unknown as NextConfig);
    const result = await configFn('phase-production-build', {
      defaultConfig: {},
    });

    expect(typeof result.webpack).toBe('function');

    const out = (result.webpack as unknown as WebpackFn)(
      { plugins: [], resolve: {} },
      {}
    );

    expect(userWebpack).toHaveBeenCalledOnce();
    expect(out.plugins).toHaveLength(1);
    expect(out.plugins[0]).toBeInstanceOf(DotenvxWebpackPlugin);
    expect(out.resolve.alias['@next/env']).toBeTruthy();
  });

  it('activates turbopack injection and registers no webpack plugin under turbopack', async () => {
    process.env.TURBOPACK = '1';
    const { withDotenvx } = await import('./plugin.js');

    const configFn = withDotenvx({});
    const result = await configFn('phase-development-server', {
      defaultConfig: {},
    });

    expect(activateTurbopackInjection).toHaveBeenCalledOnce();

    const out = (result.webpack as unknown as WebpackFn)(
      { plugins: [], resolve: {} },
      {}
    );
    expect(out.plugins).toHaveLength(0);
  });

  it('overloads process.env by default', async () => {
    const { withDotenvx } = await import('./plugin.js');

    await withDotenvx({}, { files: ['.env'] })('phase-production-build', {
      defaultConfig: {},
    });

    expect(configMock).toHaveBeenCalledWith(
      expect.objectContaining({ overload: true })
    );
  });

  it('forwards overload:false so a set NODE_ENV wins over the file', async () => {
    const { withDotenvx } = await import('./plugin.js');

    await withDotenvx({}, { files: ['.env'], overload: false })(
      'phase-production-build',
      { defaultConfig: {} }
    );

    expect(configMock).toHaveBeenCalledWith(
      expect.objectContaining({ overload: false })
    );
  });

  it('supports a function-style next config', async () => {
    const { withDotenvx } = await import('./plugin.js');
    const innerConfig = vi.fn(() => ({ poweredByHeader: false }));

    const configFn = withDotenvx(innerConfig as unknown as NextConfig);
    const result = await configFn('phase-production-build', {
      defaultConfig: {},
    });

    expect(innerConfig).toHaveBeenCalledOnce();
    expect(result.poweredByHeader).toBe(false);
    expect(typeof result.webpack).toBe('function');
  });
});
