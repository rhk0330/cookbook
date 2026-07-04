import { BrowserWindow, app, ipcMain, protocol } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings, LanguageCode, PixabayImageOption, RecipeDraft } from "@shared/types";
import { BackupService } from "./backup";
import { MediaService, registerMediaProtocol } from "./media";
import { PdfService } from "./pdf";
import { getDataPaths } from "./paths";
import { RecipeRepository } from "./repository";
import { seedRecipesIfNeeded } from "./seed";
import { WifiCookbookServer } from "./wifi-server";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "cookbook",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

let repository: RecipeRepository | null = null;
let mediaService: MediaService | null = null;
let backupService: BackupService | null = null;
let pdfService: PdfService | null = null;
let wifiServer: WifiCookbookServer | null = null;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 720,
    icon: getIconPath(),
    backgroundColor: "#ffffff",
    title: "Korean Cookbook",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function getIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "resources", "icon.ico")
    : join(process.cwd(), "resources", "icon.ico");
}

function getRendererRoot(): string {
  return app.isPackaged
    ? join(__dirname, "../renderer")
    : join(process.cwd(), "out/renderer");
}

app.whenReady().then(async () => {
  app.setAppUserModelId("local.korean.cookbook");
  const paths = getDataPaths();
  registerMediaProtocol(paths);
  repository = await RecipeRepository.open(paths);
  mediaService = new MediaService(paths);
  backupService = new BackupService(paths, repository);
  pdfService = new PdfService(paths);
  seedRecipesIfNeeded(repository, mediaService);
  wifiServer = new WifiCookbookServer({
    paths,
    rendererRoot: getRendererRoot(),
    repository,
    mediaService,
    backupService,
    pdfService,
    getPixabayApiKey
  });
  await wifiServer.syncWithSettings();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void wifiServer?.stop();
  repository?.close();
});

function registerIpcHandlers(): void {
  ipcMain.handle("recipes:list", () => getRepository().list());
  ipcMain.handle("recipes:search", (_event, query: string) =>
    getRepository().search(query)
  );
  ipcMain.handle("recipes:get", (_event, id: string) => getRepository().get(id));
  ipcMain.handle("recipes:create", (_event, draft: RecipeDraft) => {
    const created = getRepository().create(draft);
    if (!created.coverImage) {
      const cover = getMediaService().generateCover(created);
      return getRepository().setCoverImage(created.id, cover);
    }

    return created;
  });
  ipcMain.handle("recipes:update", (_event, id: string, draft: RecipeDraft) =>
    getRepository().update(id, draft)
  );
  ipcMain.handle("recipes:delete", (_event, id: string) => {
    getRepository().delete(id);
  });
  ipcMain.handle("recipes:exportPdf", (_event, id: string, language: AppSettings["language"]) => {
    const recipe = getRepository().get(id);
    if (!recipe) {
      throw new Error("Recipe not found.");
    }

    return getPdfService().exportRecipe(recipe, language);
  });
  ipcMain.handle("media:importImage", (_event, filePath: string) =>
    getMediaService().importImage(filePath)
  );
  ipcMain.handle("media:pickImage", () => getMediaService().pickImage());
  ipcMain.handle("media:searchPixabay", (_event, query: string, language: LanguageCode) =>
    getMediaService().searchPixabayImages({
      apiKey: getPixabayApiKey(),
      query,
      language
    })
  );
  ipcMain.handle(
    "media:importPixabayImage",
    (_event, image: PixabayImageOption, title: string) =>
      getMediaService().importPixabayImage(image, title)
  );
  ipcMain.handle("media:generateCover", (_event, recipeId: string) => {
    const recipe = getRepository().get(recipeId);
    if (!recipe) {
      throw new Error("레시피를 찾을 수 없습니다.");
    }

    const cover = getMediaService().generateCover(recipe);
    getRepository().setCoverImage(recipeId, cover);
    return cover;
  });
  ipcMain.handle("settings:get", () => getRepository().getSettings());
  ipcMain.handle("settings:update", async (_event, patch: Partial<AppSettings>) => {
    const settings = getRepository().updateSettings(patch);
    await getWifiServer().syncWithSettings(settings);
    return settings;
  });
  ipcMain.handle("sharing:getInfo", () => getWifiServer().getInfo());
  ipcMain.handle("backup:export", () => getBackupService().exportBackup());
  ipcMain.handle("backup:import", () => getBackupService().importBackup());
}

function getPixabayApiKey(): string {
  const savedKey = getRepository().getSettings().pixabayApiKey.trim();
  if (savedKey) {
    return savedKey;
  }

  const keyPaths = [
    getDataPaths().pixabayApiKey,
    join(process.cwd(), "data", "pixabay-api-key.txt")
  ];

  for (const keyPath of [...new Set(keyPaths)]) {
    if (!existsSync(keyPath)) {
      continue;
    }

    const key = readFileSync(keyPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));

    if (key) {
      return key;
    }
  }

  return "";
}

function getRepository(): RecipeRepository {
  if (!repository) {
    throw new Error("Recipe repository is not ready.");
  }

  return repository;
}

function getMediaService(): MediaService {
  if (!mediaService) {
    throw new Error("Media service is not ready.");
  }

  return mediaService;
}

function getBackupService(): BackupService {
  if (!backupService) {
    throw new Error("Backup service is not ready.");
  }

  return backupService;
}

function getPdfService(): PdfService {
  if (!pdfService) {
    throw new Error("PDF service is not ready.");
  }

  return pdfService;
}

function getWifiServer(): WifiCookbookServer {
  if (!wifiServer) {
    throw new Error("Wi-Fi sharing server is not ready.");
  }

  return wifiServer;
}
