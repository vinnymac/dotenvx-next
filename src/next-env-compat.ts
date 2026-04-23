/**
 * Drop-in replacement for @next/env that also calls dotenvx.config() after loading.
 *
 * This module must be CJS-compatible since @next/env is CJS.
 * It is aliased via webpack resolve.alias to intercept Next.js's own @next/env usage.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextEnv = require('@next/env') as typeof import('@next/env');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenvx = require('@dotenvx/dotenvx') as typeof import('@dotenvx/dotenvx');

const { loadEnvConfig: originalLoadEnvConfig, ...rest } = nextEnv;

/**
 * Resolve env files to load based on the current environment.
 * - production → ['.env.base', '.env.production']
 * - preview    → ['.env.base', '.env.preview']
 * - local dev  → skip (dotenvx run handles it via npm scripts)
 */
function resolveEnvFiles(envDir: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');

  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  let candidates: string[] = [];

  if (vercelEnv === 'production' || nodeEnv === 'production') {
    candidates = ['.env.base', '.env.production'];
  } else if (vercelEnv === 'preview') {
    candidates = ['.env.base', '.env.preview'];
  } else {
    // Local dev — dotenvx run handles env loading via package.json scripts
    return [];
  }

  return candidates.filter((f) => fs.existsSync(path.resolve(envDir, f)));
}

/**
 * Wrapped loadEnvConfig: calls Next's original, then layers in dotenvx secrets.
 */
function loadEnvConfig(
  dir: string,
  dev?: boolean,
  log?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
  forceReload?: boolean,
  onReload?: (envFilePath: string) => void,
): ReturnType<typeof import('@next/env').loadEnvConfig> {
  const result = originalLoadEnvConfig(dir, dev, log, forceReload, onReload);

  const files = resolveEnvFiles(dir);

  if (files.length > 0) {
    dotenvx.config({ path: files, overload: true, quiet: true });
  }

  return result;
}

module.exports = {
  ...rest,
  loadEnvConfig,
};
