# @fantasticfour/dotenvx-next

## 0.2.1

### Patch Changes

- Fix `@next/env` alias scope and expose full compat surface for npm overrides.

  The webpack `resolve.alias` for `@next/env` only intercepts imports inside
  webpack-compiled bundles. Next.js's own Node.js startup calls to `loadEnvConfig`
  happen before webpack runs and were not covered.

  - Re-export `loadEnvConfig`, `initialEnv`, `updateInitialEnv`, `processEnv`, and
    `resetEnv` from the package main entry so users can add
    `"overrides": { "@next/env": "@fantasticfour/dotenvx-next" }` to get full
    Node.js-level coverage of all `loadEnvConfig` call sites including startup.
  - Convert `next-env-compat` from CJS `module.exports` to ESM named exports using
    `createRequire`, fixing opaque `export {}` type declarations in the prior build.
  - Add `@next/env` to `neverBundle` so it stays external in built output.
  - Document the npm/pnpm/Yarn overrides pattern and edge runtime compatibility.

## 0.2.0

### Minor Changes

- Resolve and inline env values at build time instead of runtime.

  Previously the plugin injected an `init` bundle into the webpack/turbopack runtime that called `dotenvx.config()` at process startup on Vercel, requiring encrypted `.env` files to be traced into the serverless bundle.

  The plugin now calls `dotenvx.config()` once during the Next.js build, captures the resolved key-value pairs, and inlines a compact `Object.assign(process.env, {...})` snippet directly into the runtime. Encrypted `.env` files no longer need to be present at runtime.

  **Breaking changes:**

  - Removed `traceEnvFiles` option — env files are no longer needed at runtime so there is nothing to trace.
