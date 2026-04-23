/**
 * Drop-in replacement for @next/env that wraps loadEnvConfig to also call
 * dotenvx.config() so dotenvx-decrypted values are present in process.env
 * whenever loadEnvConfig is invoked.
 *
 * Two coverage levels:
 *
 * 1. Webpack alias (partial): plugin.ts sets webpack resolve.alias['@next/env']
 *    to this module. Intercepts imports of @next/env INSIDE webpack-bundled code
 *    (hot-reload handlers, preview mode helpers in the server bundle).
 *    Does NOT cover Next.js's own Node.js startup calls to loadEnvConfig, which
 *    happen before webpack runs.
 *
 * 2. npm overrides (full): users add "@next/env" → "@fantasticfour/dotenvx-next"
 *    in package.json overrides/resolutions. Node.js resolves require('@next/env')
 *    to this package's CJS entry, which re-exports loadEnvConfig, covering startup.
 *
 * @next/env is CJS-only, so createRequire is used to load it from ESM.
 */

import { createRequire } from 'node:module';
import dotenvx from '@dotenvx/dotenvx';
import type {
  Env,
  LoadedEnvFiles,
  loadEnvConfig as LoadEnvConfigFn,
} from '@next/env';

const require = createRequire(import.meta.url);

const nextEnv = require('@next/env') as typeof import('@next/env');

const {
  loadEnvConfig: originalLoadEnvConfig,
  initialEnv,
  updateInitialEnv,
  processEnv,
  resetEnv,
} = nextEnv;

export function loadEnvConfig(
  ...args: Parameters<typeof LoadEnvConfigFn>
): ReturnType<typeof LoadEnvConfigFn> {
  dotenvx.config({ quiet: true });
  return originalLoadEnvConfig(...args);
}

export type { Env, LoadedEnvFiles };
export { initialEnv, updateInitialEnv, processEnv, resetEnv };
