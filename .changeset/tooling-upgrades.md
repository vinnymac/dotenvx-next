---
"@fantasticfour/dotenvx-next": patch
---

Upgrade TypeScript to v6.0 and modernize dev tooling.

- **TypeScript 6.0** — upgraded from 5.9. No public API changes; generated types are identical.
- **pnpm 10.33.2** — updated package manager and lockfile.
- **Native Git hooks** — replaced `husky` + `lint-staged` (29 packages) with a committed `.githooks/pre-commit` script driven by Git 2.54 config-based hooks. Biome formatting on staged files is preserved; `pnpm install` still wires up the hook automatically via `prepare`.
- **pnpm security hardening** — `minimumReleaseAge`, `blockExoticSubdeps`, `trustPolicy`, and `strictDepBuilds` moved to `pnpm-workspace.yaml`.
