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

This plugin injects the dotenvx init bundle directly into webpack and turbopack runtime files at build time, so decryption happens before any user module is imported.

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

By default it loads `.env` from your project root.

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

Because env values are inlined at build time, no encrypted `.env` files need to be present in the deployed serverless bundle.

## Debugging

Set `DEBUG_DOTENVX_NEXT=1` to see injection logs during your build.
