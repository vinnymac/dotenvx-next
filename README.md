# @fantasticfour/dotenvx-next

A Next.js plugin that loads [dotenvx](https://dotenvx.com) secrets before any user code evaluates at runtime. It solves the timing problem where encrypted env vars need to be decrypted before modules like Prisma initialize their connection pools.

## The problem

dotenvx decrypts secrets at startup, but Next.js evaluates server modules before that decryption runs. Two common patterns break silently:

**`instrumentation.ts`** — Next.js's official hook for startup side-effects runs _after_ modules have already been imported. By the time `dotenvx.config()` executes there, any module-scope code has already read `process.env`:

```ts
// instrumentation.ts — too late
export async function register() {
  const { config } = await import('@dotenvx/dotenvx');
  config(); // DATABASE_URL was already read as undefined
}
```

**Module-scope `process.env` access** — Anything that reads an env var at the top level of a module (outside a function) runs at import time, before any instrumentation or config call:

```ts
// db.ts — evaluated at import time
const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // undefined ✗
```

This plugin decrypts env files at build time and inlines the resolved values directly into the webpack and turbopack runtime, so they are available before any user module is imported.

## Install

```bash
npm install @fantasticfour/dotenvx-next
```

Requires `next >= 14`.

## Usage

Wrap your Next.js config with `withDotenvx`:

```ts
// next.config.ts
import { withDotenvx } from '@fantasticfour/dotenvx-next';

export default withDotenvx({
  // your existing Next.js config
});
```

By default it loads `.env` from your project root. Because values are inlined at build time, no encrypted env files need to be present in the deployed serverless bundle, and you do not need `dotenvx run` in your dev or build scripts.

### Full `@next/env` coverage with package overrides

The plugin calls `dotenvx.config()` at build time (during `next.config.ts`
evaluation) and inlines the resolved values into the webpack/turbopack runtime.
This covers the common case — module-scope `process.env` reads at import time.

However, Next.js also calls `loadEnvConfig` from `@next/env` during its own
**Node.js startup**, before webpack runs. The webpack `resolve.alias` set by
this plugin only intercepts imports inside webpack-compiled code, so those
startup calls are not covered by the alias alone.

To get full coverage at the Node.js package-resolution level, add an override
so that `require('@next/env')` resolves to this package instead:

**npm** (`package.json`):

```json
{
  "overrides": {
    "@next/env": "@fantasticfour/dotenvx-next"
  }
}
```

**pnpm** (`package.json`):

```json
{
  "pnpm": {
    "overrides": {
      "@next/env": "@fantasticfour/dotenvx-next"
    }
  }
}
```

**Yarn** (`package.json`):

```json
{
  "resolutions": {
    "@next/env": "@fantasticfour/dotenvx-next"
  }
}
```

With this override, `require('@next/env').loadEnvConfig` returns the wrapped
version that calls `dotenvx.config()` first — at all call sites, including
Next.js's own startup code.

### Multiple environments

The `files` option accepts any list of env files. Because the plugin resolves them at build time, you are responsible for selecting the right files for the current environment. On Vercel, `VERCEL_ENV` is set during the build:

```ts
// next.config.ts
const vercelEnv = process.env.VERCEL_ENV;

export default withDotenvx(config, {
  files:
    vercelEnv === 'production'
      ? ['.env.base', '.env.production']
      : vercelEnv === 'preview'
        ? ['.env.base', '.env.preview']
        : ['.env'], // local dev
});
```

Passing an empty array (`files: []`) skips decryption entirely for that build, which is useful if you want to handle local dev with `dotenvx run` separately rather than baking values into the dev server runtime.

### Options

```ts
withDotenvx(nextConfig, {
  // Env files to load. Defaults to ['.env']
  files: ['.env', '.env.production'],

  // Directory where env files live. Defaults to process.cwd()
  envDir: '/path/to/env/files',
})
```

### With an async config function

```ts
export default withDotenvx(async (phase) => {
  return {
    // your config
  };
});
```

## How it works

At build time, `dotenvx.config()` decrypts the specified env files and the resolved key-value pairs are serialized into a compact `Object.assign(process.env, {...})` snippet.

**Webpack builds:** `DotenvxWebpackPlugin` prepends this snippet to `webpack-runtime.js` via the `processAssets` hook at `PROCESS_ASSETS_STAGE_ADDITIONS`, so every value is available before any module code runs.

**Turbopack builds:** Since turbopack bypasses webpack's plugin API, the plugin patches `fs.writeFile` to detect when compilation completes (signaled by `export-detail.json` being written), then prepends the same snippet into `[turbopack]_runtime.js`.

**`@next/env` webpack alias:** The plugin sets `webpack resolve.alias['@next/env']` to a compat shim that wraps `loadEnvConfig` to run `dotenvx.config()` first. This covers any import of `@next/env` inside webpack-compiled server bundles (hot-reload handlers, preview mode helpers). It does not cover Next.js's own pre-webpack startup calls — use the [npm overrides pattern](#full-nextenv-coverage-with-package-overrides) for full coverage.

**Edge runtime:** The webpack plugin detects edge runtime compilations via `compiler.options.target` and injects into `edge-runtime-webpack.js` rather than `webpack-runtime.js`. The inline snippet uses a `typeof process !== 'undefined'` guard, so it is safe in edge runtimes where `process` may be absent.

## Debugging

Set `DEBUG_DOTENVX_NEXT=1` to see injection logs during your build.
