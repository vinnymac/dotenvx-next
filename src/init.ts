/**
 * Runtime init bundle — injected into webpack/turbopack runtime before any user code runs.
 * This is a self-contained CJS-compatible snippet that runs in the webpack runtime context.
 *
 * The string '__DOTENVX_FILES__' is replaced by DotenvxWebpackPlugin via string substitution
 * with a JSON-encoded array of env file paths before this source is prepended to the runtime.
 *
 * Guard against double-init (worker processes, HMR) via a globalThis flag.
 */

// Augment global type to include our guard flag
declare global {
  // eslint-disable-next-line no-var
  var __dotenvxNextInit: boolean | undefined;
}

if (typeof process !== 'undefined' && !globalThis.__dotenvxNextInit) {
  globalThis.__dotenvxNextInit = true;

  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === 'production' || vercelEnv === 'preview') {
    // '__DOTENVX_FILES__' is replaced at injection time with the actual JSON-encoded file list
    const files = JSON.parse('__DOTENVX_FILES__') as string[];

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@dotenvx/dotenvx') as typeof import('@dotenvx/dotenvx')).config({
      path: files,
      overload: true,
      quiet: true,
    });
  }
}
