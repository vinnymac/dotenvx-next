---
"@fantasticfour/dotenvx-next": minor
---

Add an `overload` option to `withDotenvx` that controls whether env file values overwrite existing `process.env` variables. Set it to `false` to prevent a local env file from clobbering values like `NODE_ENV` that are already set by the invoking `next build` or `next dev` command.
