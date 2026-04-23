# @fantasticfour/dotenvx-next

## 0.2.0

### Minor Changes

- Resolve and inline env values at build time instead of runtime.

  Previously the plugin injected an `init` bundle into the webpack/turbopack runtime that called `dotenvx.config()` at process startup on Vercel, requiring encrypted `.env` files to be traced into the serverless bundle.

  The plugin now calls `dotenvx.config()` once during the Next.js build, captures the resolved key-value pairs, and inlines a compact `Object.assign(process.env, {...})` snippet directly into the runtime. Encrypted `.env` files no longer need to be present at runtime.

  **Breaking changes:**

  - Removed `traceEnvFiles` option — env files are no longer needed at runtime so there is nothing to trace.
