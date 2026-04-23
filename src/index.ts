export { withDotenvx } from './plugin.js';
export type { DotenvxNextOptions } from './plugin.js';

// Re-export the @next/env compat surface so this package can serve as an npm
// overrides / pnpm.overrides replacement for @next/env. When users add:
//   "overrides": { "@next/env": "@fantasticfour/dotenvx-next" }
// require('@next/env') resolves to this package's CJS entry, which exposes
// loadEnvConfig (and the full @next/env API) through these re-exports.
export {
  initialEnv,
  updateInitialEnv,
  processEnv,
  resetEnv,
  loadEnvConfig,
} from './next-env-compat.js';
export type { Env, LoadedEnvFiles } from './next-env-compat.js';
