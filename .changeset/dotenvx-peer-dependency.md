---
"@fantasticfour/dotenvx-next": patch
---

Move `@dotenvx/dotenvx` from `dependencies` to `peerDependencies`.

This package is a build-time bridge between dotenvx and Next.js — any consumer already has `@dotenvx/dotenvx` installed. Listing it as a direct dependency caused npm/pnpm to install a redundant second copy (82.1 kB install / 5.2 MB unpacked) and risked silent version mismatches between the plugin and the user's own dotenvx config.

With this change, the package resolves dotenvx from the consumer's own install, matching the version they control. No behaviour changes.

**Migration:** ensure `@dotenvx/dotenvx` is listed in your project's `dependencies` or `devDependencies` (it almost certainly already is).
