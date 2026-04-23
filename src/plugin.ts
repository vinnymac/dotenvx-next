/**
 * withDotenvx() — Next.js config wrapper that ensures dotenvx secrets are loaded
 * before any user code evaluates (Prisma Pool, etc.) at module-load time.
 *
 * Strategy:
 * - Webpack builds: injects a dotenvx init bundle into webpack-runtime.js via
 *   DotenvxWebpackPlugin (processAssets hook at PROCESS_ASSETS_STAGE_ADDITIONS).
 * - Turbopack builds: patches fs.writeFile to detect compilation completion and
 *   prepend the init bundle into [turbopack]_runtime.js files.
 * - Also aliases @next/env → @fantasticfour/dotenvx-next/next-env so dotenvx
 *   secrets are available during Next.js config evaluation itself.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import { DotenvxWebpackPlugin } from './webpack-plugin.js';
import { activateTurbopackInjection } from './turbopack-inject.js';

export interface DotenvxNextOptions {
  /**
   * Env files to load. Defaults to ['.env.base', '.env.production', '.env.preview'],
   * filtered to files that actually exist in envDir.
   */
  files?: string[];

  /**
   * Directory where env files live. Defaults to process.cwd().
   */
  envDir?: string;

  /**
   * Add resolved env files to outputFileTracingIncludes so Vercel traces them
   * into the serverless function bundle. Default: true.
   */
  traceEnvFiles?: boolean;
}

const DEFAULT_ENV_FILES = ['.env.base', '.env.production', '.env.preview'];

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

/**
 * Load the compiled init bundle source. This is the CJS bundle from dist/init.cjs
 * that will be prepended into webpack/turbopack runtime files.
 */
function loadInitSource(): string {
  // During builds, __dirname is the dist directory (CJS output) or src (dev).
  // We resolve relative to this file's location at runtime.
  try {
    // Explicitly resolve init.cjs — not './init', which in a "type":"module" package
    // resolves to init.js (ESM) even from a CJS context, causing import-in-IIFE errors.
    return require('node:fs').readFileSync(
      require.resolve('./init.cjs'),
      'utf8'
    ) as string;
  } catch {
    // Fallback: resolve from package root
    const pkgRoot = path.resolve(new URL(import.meta.url).pathname, '../../');
    return fs.readFileSync(path.join(pkgRoot, 'dist', 'init.cjs'), 'utf8');
  }
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
  const shouldTrace = options.traceEnvFiles !== false;

  // Detect turbopack (Next 16+ uses it by default in dev)
  const isTurbopack = !!(
    process.env.TURBOPACK ||
    process.env.TURBOPACK_DEV ||
    process.env.TURBOPACK_BUILD ||
    process.env.npm_config_turbopack
  );

  debugLog(
    `phase=${phase}, isTurbopack=${isTurbopack}, resolvedFiles=${JSON.stringify(resolvedFiles)}`
  );

  // Add env files to outputFileTracingIncludes so Vercel traces them into Lambda
  // Note: outputFileTracingIncludes moved from experimental to top-level in Next 16
  if (shouldTrace && resolvedFiles.length > 0) {
    resolvedNextConfig.outputFileTracingIncludes ??= {};

    const tracing = resolvedNextConfig.outputFileTracingIncludes;
    // Apply to all server routes
    const catchAll = '/**';
    const existing = tracing[catchAll];
    if (Array.isArray(existing)) {
      tracing[catchAll] = [...existing, ...resolvedFiles];
    } else {
      tracing[catchAll] = resolvedFiles;
    }
  }

  if (isTurbopack) {
    // Turbopack: activate fs intercept to inject init bundle when compilation finishes
    try {
      const initSource = loadInitSource();
      activateTurbopackInjection(initSource);
    } catch (err) {
      console.warn(
        '[dotenvx-next] Could not load init bundle for turbopack injection:',
        err
      );
    }
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

    // Register the webpack plugin to inject init bundle into runtime files
    if (!isTurbopack) {
      try {
        const initSource = loadInitSource();
        const plugin = new DotenvxWebpackPlugin({
          files: resolvedFiles,
          initSource,
        });
        (config.plugins as unknown[]).push(plugin);
      } catch (err) {
        console.warn(
          '[dotenvx-next] Could not load init bundle for webpack injection:',
          err
        );
      }
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
