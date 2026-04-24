# Contributing

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm build       # compile once
pnpm dev         # watch mode
pnpm typecheck   # type-check without emitting
pnpm lint        # lint with Biome
pnpm test        # run tests with Vitest
```

## Submitting Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes and add tests where appropriate.
3. Run `pnpm test` and `pnpm typecheck` — both must pass.
4. Add a changeset describing your change:
   ```sh
   pnpm changeset
   ```
5. Open a pull request against `main`.

Changesets drive the release notes and version bumps, so every user-facing change needs one.
