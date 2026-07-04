import { app } from "electron";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface DataPaths {
  root: string;
  database: string;
  pixabayApiKey: string;
  images: string;
  generatedCovers: string;
  backups: string;
}

export function getDataPaths(): DataPaths {
  const root =
    process.env.COOKBOOK_DATA_DIR ??
    (app.isPackaged
      ? join(dirname(process.execPath), "data")
      : resolve(process.cwd(), "data"));

  const paths = {
    root,
    database: join(root, "cookbook.sqlite"),
    pixabayApiKey: join(root, "pixabay-api-key.txt"),
    images: join(root, "images"),
    generatedCovers: join(root, "generated-covers"),
    backups: join(root, "backups")
  };

  for (const directory of [
    paths.root,
    paths.images,
    paths.generatedCovers,
    paths.backups
  ]) {
    mkdirSync(directory, { recursive: true });
  }

  return paths;
}
