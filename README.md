# Minimal Korean Cookbook

A local Korean-first cookbook desktop app built with Electron, React, TypeScript, and SQLite.

## Features

- One continuous white page with welcome search, recipe detail/editor, and responsive recipe grid.
- Korean and English recipe parsing with local heuristics only.
- Emoji suggestions, allergen hints, Hangul-aware search, and deterministic generated covers.
- Local SQLite storage plus local image folders under `data/`.
- Electron preload API keeps renderer code away from direct filesystem and database access.

## Development

This repository expects Node.js and pnpm/npm to be available.

```powershell
pnpm install
pnpm dev
```

Build and package:

```powershell
pnpm build
pnpm package
```

## Data

Development data is stored in:

```text
data/
  cookbook.sqlite
  images/
  generated-covers/
  backups/
```

Packaged builds use a `data/` folder beside the application executable unless `COOKBOOK_DATA_DIR` is set.
