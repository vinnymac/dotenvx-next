# Contributing

## Setup

```sh
pnpm install
```

### Optional: pre-commit formatting hook

This repo ships a Git 2.54 config-based hook that runs `biome format` on staged
files. It's opt-in so installs never modify your Git config automatically.
Enable it locally with:

```sh
git config --local include.path ../.gitconfig
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
