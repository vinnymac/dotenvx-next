# @fantasticfour/dotenvx-next

## 0.2.4

### Patch Changes

- 0d558e8: Add community health files and package metadata best practices.

  - Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
  - Add `CONTRIBUTING.md` with setup, development, and PR workflow docs
  - Add `SECURITY.md` with supported versions and private vulnerability reporting instructions
  - Add `author`, `homepage`, `bugs`, and `keywords` fields to `package.json` for better npm discoverability
  - Add socket.dev security score badge to README

## 0.2.3

### Patch Changes

- fd62343: Move `@dotenvx/dotenvx` from `dependencies` to `peerDependencies`.

  This package is a build-time bridge between dotenvx and Next.js — any consumer already has `@dotenvx/dotenvx` installed. Listing it as a direct dependency caused npm/pnpm to install a redundant second copy (82.1 kB install / 5.2 MB unpacked) and risked silent version mismatches between the plugin and the user's own dotenvx config.

  With this change, the package resolves dotenvx from the consumer's own install, matching the version they control. No behaviour changes.

  **Migration:** ensure `@dotenvx/dotenvx` is listed in your project's `dependencies` or `devDependencies` (it almost certainly already is).

- fd62343: Upgrade TypeScript to v6.0 and modernize dev tooling.

  - **TypeScript 6.0** — upgraded from 5.9. No public API changes; generated types are identical.
  - **pnpm 10.33.2** — updated package manager and lockfile.
  - **Native Git hooks** — replaced `husky` + `lint-staged` (29 packages) with a committed `.githooks/pre-commit` script driven by Git 2.54 config-based hooks. Biome formatting on staged files is preserved; `pnpm install` still wires up the hook automatically via `prepare`.
  - **pnpm security hardening** — `minimumReleaseAge`, `blockExoticSubdeps`, `trustPolicy`, and `strictDepBuilds` moved to `pnpm-workspace.yaml`.

## 0.2.2

### Patch Changes

- Move `@dotenvx/dotenvx` from `dependencies` to `peerDependencies`.

  This package is a build-time bridge between dotenvx and Next.js — any consumer
  already has `@dotenvx/dotenvx` installed. Listing it as a direct dependency caused
  npm/pnpm to install a redundant second copy (82.1 kB install / 5.2 MB unpacked)
  and risked silent version mismatches between the plugin and the user's own dotenvx
  config.

  With this change, the package resolves dotenvx from the consumer's own install,
  matching the version they control. No behaviour changes.

  **Migration:** ensure `@dotenvx/dotenvx` is listed in your project's `dependencies`
  or `devDependencies` (it almost certainly already is).

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
