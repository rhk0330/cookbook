import { dialog } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Recipe } from "@shared/types";
import type { DataPaths } from "./paths";
import type { RecipeRepository } from "./repository";

interface BackupAsset {
  localPath: string;
  contentBase64: string;
}

interface BackupPayload {
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
  assets: BackupAsset[];
}

export class BackupService {
  constructor(
    private readonly paths: DataPaths,
    private readonly repository: RecipeRepository
  ) {}

  async exportBackup(): Promise<string | null> {
    const defaultPath = join(
      this.paths.backups,
      `cookbook-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    const result = await dialog.showSaveDialog({
      title: "레시피 백업 저장",
      defaultPath,
      filters: [{ name: "Cookbook Backup", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const payload = this.createBackupPayload();

    writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf8");
    return result.filePath;
  }

  createBackupPayload(): BackupPayload {
    const recipes = this.repository.list();
    const assets = collectAssets(this.paths.root, recipes);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes,
      assets
    };
  }

  async importBackup(): Promise<Recipe[]> {
    const result = await dialog.showOpenDialog({
      title: "레시피 백업 가져오기",
      properties: ["openFile"],
      filters: [{ name: "Cookbook Backup", extensions: ["json"] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return this.repository.list();
    }

    const payload = JSON.parse(readFileSync(result.filePaths[0], "utf8")) as BackupPayload;
    return this.importBackupPayload(payload);
  }

  importBackupPayload(payload: BackupPayload): Recipe[] {
    if (payload.version !== 1 || !Array.isArray(payload.recipes)) {
      throw new Error("지원하지 않는 백업 파일입니다.");
    }

    for (const asset of payload.assets ?? []) {
      const fullPath = resolve(this.paths.root, asset.localPath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, Buffer.from(asset.contentBase64, "base64"));
    }

    return this.repository.replaceAll(payload.recipes);
  }
}

function collectAssets(root: string, recipes: Recipe[]): BackupAsset[] {
  const assets: BackupAsset[] = [];

  for (const recipe of recipes) {
    if (!recipe.coverImage) {
      continue;
    }

    const fullPath = resolve(root, recipe.coverImage.localPath);
    if (!existsSync(fullPath)) {
      continue;
    }

    assets.push({
      localPath: recipe.coverImage.localPath,
      contentBase64: readFileSync(fullPath).toString("base64")
    });
  }

  return assets;
}
