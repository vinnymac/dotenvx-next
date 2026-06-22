---
"@fantasticfour/dotenvx-next": minor
---

Fix env injection for the edge runtime. The webpack plugin now injects
build-time env into whichever runtime asset a compilation emits (server or
edge) rather than relying on `compiler.options.target`, which is not tagged
`"webworker"` for the edge build. Edge route handlers now receive the decrypted
values.
