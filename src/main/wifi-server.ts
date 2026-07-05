import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, resolve } from "node:path";
import type {
  AppSettings,
  ImageAsset,
  LanguageCode,
  PixabayImageOption,
  Recipe,
  RecipeDraft,
  WifiSharingInfo
} from "@shared/types";
import type { BackupService } from "./backup";
import type { DataPaths } from "./paths";
import type { MediaService } from "./media";
import type { PdfService } from "./pdf";
import type { RecipeRepository } from "./repository";

interface WifiCookbookServerOptions {
  paths: DataPaths;
  rendererRoot: string;
  repository: RecipeRepository;
  mediaService: MediaService;
  backupService: BackupService;
  pdfService: PdfService;
  getPixabayApiKey: () => string;
}

interface UploadImageRequest {
  fileName: string;
  contentBase64: string;
}

export class WifiCookbookServer {
  private server: Server | null = null;
  private actualPort = 0;
  private currentEditRecipeId: string | null = null;

  constructor(private readonly options: WifiCookbookServerOptions) {}

  async syncWithSettings(settings = this.options.repository.getSettings()): Promise<void> {
    if (!settings.wifiSharingEnabled) {
      await this.stop();
      return;
    }

    await this.start(settings.wifiSharingPort);
  }

  async start(preferredPort: number): Promise<void> {
    if (this.server && this.actualPort === preferredPort) {
      return;
    }

    await this.stop();

    for (let offset = 0; offset <= 20; offset += 1) {
      const port = preferredPort + offset;
      try {
        await this.listen(port);
        this.actualPort = port;
        return;
      } catch {
        await this.stop();
      }
    }

    throw new Error("Could not start Wi-Fi sharing.");
  }

  async stop(): Promise<void> {
    if (!this.server) {
      this.actualPort = 0;
      return;
    }

    const server = this.server;
    this.server = null;
    this.actualPort = 0;
    await new Promise<void>((resolvePromise) => {
      server.close(() => resolvePromise());
    });
  }

  getInfo(): WifiSharingInfo {
    const settings = this.options.repository.getSettings();
    const port = this.actualPort || settings.wifiSharingPort;
    const addresses = getLanAddresses();
    const ipAddress = addresses[0] ?? "";
    const allUrls = addresses.map((address) => `http://${address}:${port}`);

    return {
      enabled: settings.wifiSharingEnabled,
      running: Boolean(this.server),
      port,
      ipAddress,
      primaryUrl: ipAddress ? `http://${ipAddress}:${port}` : "",
      friendlyUrl: `http://cookbook.local:${port}`,
      allUrls
    };
  }

  setCurrentEditRecipeId(id: string | null): void {
    this.currentEditRecipeId = id?.trim() || null;
  }

  private async listen(port: number): Promise<void> {
    const server = createServer((request, response) => {
      void this.handleRequest(request, response).catch((error) => {
        this.sendError(response, error);
      });
    });

    await new Promise<void>((resolvePromise, reject) => {
      const handleError = (error: Error): void => {
        server.off("listening", handleListening);
        reject(error);
      };
      const handleListening = (): void => {
        server.off("error", handleError);
        resolvePromise();
      };

      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(port, "0.0.0.0");
    });

    this.server = server;
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    if (!request.url) {
      this.sendText(response, "Not found", 404);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await this.handleApiRequest(request, response, url);
      return;
    }

    if (url.pathname.startsWith("/media/")) {
      this.handleMediaRequest(response, url);
      return;
    }

    if (url.pathname === "/edit-current") {
      this.handleEditCurrentRequest(response);
      return;
    }

    this.handleStaticRequest(response, url);
  }

  private async handleApiRequest(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL
  ): Promise<void> {
    const method = request.method ?? "GET";
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/api/health") {
      this.sendJson(response, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/api/sharing") {
      this.sendJson(response, this.getInfo());
      return;
    }

    if (method === "POST" && pathname === "/api/sharing/edit-target") {
      const body = await readJsonBody<{ id: string | null }>(request);
      this.setCurrentEditRecipeId(body.id);
      response.writeHead(204);
      response.end();
      return;
    }

    if (method === "GET" && pathname === "/api/sync-revision") {
      this.sendJson(response, this.options.repository.getRevision());
      return;
    }

    if (method === "GET" && pathname === "/api/settings") {
      this.sendJson(response, this.options.repository.getSettings());
      return;
    }

    if (method === "PATCH" && pathname === "/api/settings") {
      const patch = await readJsonBody<Partial<AppSettings>>(request);
      const settings = this.options.repository.updateSettings(patch);
      this.sendJson(response, settings);
      setTimeout(() => {
        void this.syncWithSettings(settings);
      }, 50);
      return;
    }

    if (method === "GET" && pathname === "/api/recipes") {
      this.sendJson(response, this.options.repository.list().map((recipe) => this.toHttpRecipe(recipe)));
      return;
    }

    if (method === "POST" && pathname === "/api/recipes") {
      const draft = await readJsonBody<RecipeDraft>(request);
      const created = this.options.repository.create(draft);
      const recipe = created.coverImage || created.coverImages.length > 0
        ? created
        : this.options.repository.setCoverImage(
            created.id,
            this.options.mediaService.generateCover(created)
          );
      this.sendJson(response, this.toHttpRecipe(recipe), 201);
      return;
    }

    if (method === "GET" && pathname === "/api/recipes/search") {
      const query = url.searchParams.get("q") ?? "";
      this.sendJson(response, this.options.repository.search(query).map((recipe) => this.toHttpRecipe(recipe)));
      return;
    }

    const recipeMatch = pathname.match(/^\/api\/recipes\/([^/]+)(?:\/(.+))?$/);
    if (recipeMatch) {
      await this.handleRecipeRequest(request, response, url, recipeMatch[1], recipeMatch[2]);
      return;
    }

    if (method === "POST" && pathname === "/api/media/import-upload") {
      const body = await readJsonBody<UploadImageRequest>(request);
      const content = Buffer.from(body.contentBase64, "base64");
      const image = this.options.mediaService.importImageBuffer(body.fileName, content);
      this.sendJson(response, this.toHttpImage(image));
      return;
    }

    if (method === "POST" && pathname === "/api/media/search-pixabay") {
      const body = await readJsonBody<{ query: string; language: LanguageCode }>(request);
      const results = await this.options.mediaService.searchPixabayImages({
        apiKey: this.options.getPixabayApiKey(),
        query: body.query,
        language: body.language
      });
      this.sendJson(response, results);
      return;
    }

    if (method === "POST" && pathname === "/api/media/import-pixabay") {
      const body = await readJsonBody<{ image: PixabayImageOption; title: string }>(request);
      const image = await this.options.mediaService.importPixabayImage(
        body.image,
        body.title
      );
      this.sendJson(response, this.toHttpImage(image));
      return;
    }

    if (method === "POST" && pathname === "/api/media/generate-cover") {
      const body = await readJsonBody<{ recipeId: string }>(request);
      const recipe = this.options.repository.get(body.recipeId);
      if (!recipe) {
        this.sendText(response, "Recipe not found.", 404);
        return;
      }

      const image = this.options.mediaService.generateCover(recipe);
      this.options.repository.setCoverImage(recipe.id, image);
      this.sendJson(response, this.toHttpImage(image));
      return;
    }

    if (method === "GET" && pathname === "/api/backup/export") {
      const payload = this.options.backupService.createBackupPayload();
      const fileName = `cookbook-backup-${new Date().toISOString().slice(0, 10)}.json`;
      this.sendDownload(response, JSON.stringify(payload, null, 2), "application/json", fileName);
      return;
    }

    if (method === "POST" && pathname === "/api/backup/import") {
      const payload = await readJsonBody<Parameters<BackupService["importBackupPayload"]>[0]>(request);
      const recipes = this.options.backupService.importBackupPayload(payload);
      this.sendJson(response, recipes.map((recipe) => this.toHttpRecipe(recipe)));
      return;
    }

    this.sendText(response, "Not found", 404);
  }

  private async handleRecipeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
    id: string,
    action?: string
  ): Promise<void> {
    const method = request.method ?? "GET";

    if (method === "GET" && !action) {
      const recipe = this.options.repository.get(id);
      this.sendJson(response, recipe ? this.toHttpRecipe(recipe) : null);
      return;
    }

    if (method === "PUT" && !action) {
      const draft = await readJsonBody<RecipeDraft>(request);
      const previous = this.options.repository.get(id);
      const updated = this.options.repository.update(id, draft);
      this.options.mediaService.cleanupUnusedGeneratedCovers(previous, updated);
      this.sendJson(response, this.toHttpRecipe(updated));
      return;
    }

    if (method === "DELETE" && !action) {
      this.options.repository.delete(id);
      response.writeHead(204);
      response.end();
      return;
    }

    if (method === "GET" && action === "pdf") {
      const recipe = this.options.repository.get(id);
      if (!recipe) {
        this.sendText(response, "Recipe not found.", 404);
        return;
      }

      const language = normalizeLanguage(url.searchParams.get("language"));
      const pdf = await this.options.pdfService.renderRecipePdf(recipe, language);
      this.sendDownload(
        response,
        pdf,
        "application/pdf",
        `${sanitizeDownloadName(recipe.title || "recipe")}.pdf`
      );
      return;
    }

    this.sendText(response, "Not found", 404);
  }

  private handleMediaRequest(response: ServerResponse, url: URL): void {
    const localPath = decodeURIComponent(url.pathname.slice("/media/".length));
    const fullPath = resolve(this.options.paths.root, localPath);
    if (
      !isInside(this.options.paths.root, fullPath) ||
      !existsSync(fullPath) ||
      !statSync(fullPath).isFile()
    ) {
      this.sendText(response, "Not found", 404);
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypeForPath(fullPath),
      "Cache-Control": "public, max-age=86400"
    });
    createReadStream(fullPath).pipe(response);
  }

  private handleEditCurrentRequest(response: ServerResponse): void {
    const destination = this.currentEditRecipeId
      ? `/?edit=${encodeURIComponent(this.currentEditRecipeId)}`
      : "/";

    response.writeHead(302, {
      Location: destination,
      "Cache-Control": "no-store"
    });
    response.end();
  }

  private handleStaticRequest(response: ServerResponse, url: URL): void {
    const requestedPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const fullPath = resolve(this.options.rendererRoot, requestedPath);
    const fallbackPath = resolve(this.options.rendererRoot, "index.html");
    const staticPath =
      isInside(this.options.rendererRoot, fullPath) &&
      existsSync(fullPath) &&
      statSync(fullPath).isFile()
        ? fullPath
        : fallbackPath;

    if (!existsSync(staticPath)) {
      this.sendText(response, "Renderer build not found. Run pnpm build first.", 503);
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypeForPath(staticPath),
      "Cache-Control": staticPath.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=31536000, immutable"
    });
    createReadStream(staticPath).pipe(response);
  }

  private toHttpRecipe(recipe: Recipe): Recipe {
    return {
      ...recipe,
      coverImage: this.toHttpImage(recipe.coverImage),
      coverImages: recipe.coverImages.map((image) => this.toHttpImage(image)).filter(isImageAsset),
      steps: recipe.steps.map((step) => ({
        ...step,
        images: step.images.map((image) => this.toHttpImage(image)).filter(isImageAsset)
      }))
    };
  }

  private toHttpImage(image: ImageAsset | null): ImageAsset | null {
    if (!image) {
      return null;
    }

    return {
      ...image,
      url: `/media/${encodeMediaPath(image.localPath)}?v=${encodeURIComponent(image.createdAt)}`
    };
  }

  private sendJson(response: ServerResponse, value: unknown, status = 200): void {
    this.sendDownload(response, JSON.stringify(value), "application/json", undefined, status);
  }

  private sendDownload(
    response: ServerResponse,
    content: string | Buffer,
    contentType: string,
    fileName?: string,
    status = 200
  ): void {
    response.writeHead(status, {
      "Content-Type": contentType,
      ...(contentType === "application/json"
        ? {
            "Cache-Control": "no-store"
          }
        : {}),
      ...(fileName
        ? {
            "Content-Disposition": `attachment; filename="${fileName}"`
          }
        : {})
    });
    response.end(content);
  }

  private sendText(response: ServerResponse, text: string, status: number): void {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(text);
  }

  private sendError(response: ServerResponse, error: unknown): void {
    if (response.headersSent) {
      response.end();
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    this.sendText(response, message, 500);
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let totalLength = 0;
  const maxLength = 28 * 1024 * 1024;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalLength += buffer.length;
    if (totalLength > maxLength) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return (body ? JSON.parse(body) : {}) as T;
}

function getLanAddresses(): string[] {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, items]) =>
    (items ?? [])
      .filter((item) => item.family === "IPv4" && !item.internal)
      .map((item) => ({
        address: item.address,
        name,
        score: scoreAddress(name, item.address)
      }))
  );

  return candidates
    .filter((item) => isPrivateAddress(item.address))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.address);
}

function scoreAddress(name: string, address: string): number {
  const normalizedName = name.toLowerCase();
  let score = 0;
  if (/wi-?fi|wireless|wlan/.test(normalizedName)) score += 40;
  if (address.startsWith("192.168.")) score += 20;
  if (address.startsWith("10.")) score += 15;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 10;
  return score;
}

function isPrivateAddress(address: string): boolean {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

function encodeMediaPath(localPath: string): string {
  return localPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function isImageAsset(image: ImageAsset | null): image is ImageAsset {
  return Boolean(image);
}

function isInside(root: string, target: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}\\`) ||
    normalizedTarget.startsWith(`${normalizedRoot}/`)
  );
}

function contentTypeForPath(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js" || extension === ".mjs") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".ico") return "image/x-icon";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function normalizeLanguage(value: string | null): LanguageCode {
  return value === "en" ? "en" : "ko";
}

function sanitizeDownloadName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim() || "recipe";
}
