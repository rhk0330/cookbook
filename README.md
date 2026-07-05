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

## Pixabay API Token

Pixabay image search is optional. The cookbook still works without a token, but the **Find image** feature needs each user to provide their own free Pixabay API key. Pixabay asks apps to show users where search results come from, so the image picker keeps a Pixabay attribution line.

1. Create or log in to a Pixabay account and open the Pixabay API docs: [https://pixabay.com/api/docs/](https://pixabay.com/api/docs/).
2. Copy your API key.
3. Create this local file in your project checkout:

```text
data/pixabay-api-key.txt
```

4. Paste only your key on the first non-comment line:

```text
YOUR_PIXABAY_API_KEY_HERE
```

The `data/` folder is ignored by Git, so your key should stay private. Do not commit or share `pixabay-api-key.txt`.

For a packaged Windows build, place the same file beside the executable inside the app data folder:

```text
data/pixabay-api-key.txt
```

You can also set `COOKBOOK_DATA_DIR` to point the app at a different data folder.
