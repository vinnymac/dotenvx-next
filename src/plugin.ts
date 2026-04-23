/**
 * withDotenvx() — Next.js config wrapper that loads dotenvx secrets at build time
 * and inlines them into the webpack/turbopack runtime so they are available before
 * any user code evaluates (Prisma Pool, etc.) at module-load time.
 *
 * Strategy:
 * - At build time, call dotenvx.config() to decrypt env files and capture the
 *   resolved key-value pairs.
 * - Webpack builds: prepend Object.assign(process.env, {...}) into webpack-runtime.js
 *   via DotenvxWebpackPlugin (processAssets hook at PROCESS_ASSETS_STAGE_ADDITIONS).
 * - Turbopack builds: patch fs.writeFile to detect compilation completion and inject
 *   the same snippet into [turbopack]_runtime.js files.
 * - Also aliases @next/env → @fantasticfour/dotenvx-next/next-env so dotenvx
 *   secrets are available during Next.js config evaluation itself.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import dotenvx from '@dotenvx/dotenvx';
import { DotenvxWebpackPlugin } from './webpack-plugin.js';
import { activateTurbopackInjection } from './turbopack-inject.js';

export interface DotenvxNextOptions {
  /**
   * Env files to load. Defaults to ['.env'], filtered to files that actually
   * exist in envDir.
   */
  files?: string[];

  /**
   * Directory where env files live. Defaults to process.cwd().
   */
  envDir?: string;
}

const DEFAULT_ENV_FILES = ['.env'];

const PLUGIN_DEBUG = !!process.env.DEBUG_DOTENVX_NEXT;

function debugLog(...args: unknown[]): void {
  if (!PLUGIN_DEBUG) return;
  console.log('[dotenvx-next]', ...args);
}

function resolveExistingFiles(files: string[], envDir: string): string[] {
  return files
    .map((f) => path.resolve(envDir, f))
    .filter((absPath) => fs.existsSync(absPath));
}

type NextConfigFn = (
  phase: string,
  defaults: { defaultConfig: NextConfig }
) => NextConfig | Promise<NextConfig>;

async function dotenvxNextConfigFn(
  nextConfig: NextConfig | NextConfigFn,
  options: DotenvxNextOptions,
  phase: string,
  defaults: { defaultConfig: NextConfig }
): Promise<NextConfig> {
  let resolvedNextConfig: NextConfig;

  if (typeof nextConfig === 'function') {
    resolvedNextConfig = {
      ...(await (nextConfig as NextConfigFn)(phase, defaults)),
    };
  } else {
    // Shallow-copy so we never mutate the frozen original config object
    resolvedNextConfig = { ...nextConfig };
  }

  const envDir = options.envDir ?? process.cwd();
  const fileNames = options.files ?? DEFAULT_ENV_FILES;
  const resolvedFiles = resolveExistingFiles(fileNames, envDir);

  // Detect turbopack (Next 16+ uses it by default in dev)
  const isTurbopack = !!(
    process.env.TURBOPACK ||
    process.env.TURBOPACK_DEV ||
    process.env.TURBOPACK_BUILD ||
    process.env.npm_config_turbopack
  );

  // Decrypt and resolve env values at build time.
  // parsed contains only the keys from the specified files (not all of process.env).
  const { parsed: env = {} } = resolvedFiles.length
    ? dotenvx.config({ path: resolvedFiles, overload: true, quiet: true })
    : { parsed: {} };

  debugLog(
    `phase=${phase}, isTurbopack=${isTurbopack}, resolvedFiles=${JSON.stringify(resolvedFiles)}, envKeys=${Object.keys(env).join(',')}`
  );

  if (isTurbopack) {
    activateTurbopackInjection(env);
  }

  // Extend webpack config (used for non-turbopack builds and edge runtime)
  const prevWebpack = resolvedNextConfig.webpack;

  resolvedNextConfig.webpack = (webpackConfig, webpackOptions) => {
    // Apply user's existing webpack customizations first
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const config = prevWebpack
      ? prevWebpack(webpackConfig, webpackOptions)
      : webpackConfig;

    // Alias @next/env to our drop-in replacement so dotenvx.config() is called
    // during Next's own env loading phase
    config.resolve ??= {};
    (config.resolve as Record<string, unknown>).alias ??= {};
    const alias = (config.resolve as Record<string, unknown>).alias as Record<
      string,
      string
    >;

    // Use require.resolve so this works from the dist directory
    try {
      alias['@next/env'] = require.resolve(
        '@fantasticfour/dotenvx-next/next-env'
      );
    } catch {
      // If the package isn't installed under that name (e.g. local dev), skip alias
      debugLog(
        'Could not resolve @fantasticfour/dotenvx-next/next-env for alias — skipping'
      );
    }

    // Register the webpack plugin to inject the env snippet into runtime files
    if (!isTurbopack) {
      (config.plugins as unknown[]).push(new DotenvxWebpackPlugin({ env }));
    }

    return config;
  };

  return resolvedNextConfig;
}

export function withDotenvx(
  nextConfig: NextConfig | NextConfigFn,
  options: DotenvxNextOptions = {}
): NextConfigFn {
  return (phase: string, defaults: { defaultConfig: NextConfig }) =>
    dotenvxNextConfigFn(nextConfig, options, phase, defaults);
}
