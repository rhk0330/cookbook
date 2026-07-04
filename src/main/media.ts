import { dialog, net, protocol } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import type { ImageAsset, LanguageCode, PixabayImageOption, Recipe } from "@shared/types";
import type { DataPaths } from "./paths";

const supportedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg"
]);

interface PixabayHit {
  id: number;
  pageURL: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL?: string;
  webformatWidth: number;
  webformatHeight: number;
  imageWidth: number;
  imageHeight: number;
  user: string;
}

interface PixabayResponse {
  hits?: PixabayHit[];
}

const titleQueryAliases = new Map([
  ["Haemul Pajeon", "해물파전"],
  ["Jeyuk Bokkeum", "제육볶음"],
  ["Dakdoritang", "닭도리탕"],
  ["Galbi Jjim", "갈비찜"],
  ["Miyeok Guk", "미역국"]
]);

export function registerMediaProtocol(paths: DataPaths): void {
  protocol.handle("cookbook", (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "media") {
      return new Response("Not found", { status: 404 });
    }

    const relativePath = decodeURIComponent(url.pathname.slice(1));
    const fullPath = resolve(paths.root, relativePath);
    if (!isInside(paths.root, fullPath) || !existsSync(fullPath)) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(fullPath).toString());
  });
}

export class MediaService {
  constructor(private readonly paths: DataPaths) {}

  importImage(filePath: string, role: ImageAsset["role"] = "cover"): ImageAsset {
    if (!filePath || !isAbsolute(filePath) || !existsSync(filePath)) {
      throw new Error("이미지 파일을 찾을 수 없습니다.");
    }

    const extension = extname(filePath).toLowerCase();
    if (!supportedImageExtensions.has(extension)) {
      throw new Error("지원하지 않는 이미지 형식입니다.");
    }

    mkdirSync(this.paths.images, { recursive: true });
    const content = readFileSync(filePath);
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const cleanName = basename(filePath, extension)
      .replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);
    const fileName = `${hash}-${cleanName || "image"}${extension}`;
    const destination = join(this.paths.images, fileName);
    copyFileSync(filePath, destination);

    const localPath = toLocalPath(this.paths.root, destination);
    return {
      id: `image_${randomUUID().replace(/-/g, "")}`,
      localPath,
      url: mediaUrl(localPath),
      role,
      altText: basename(filePath),
      source: "imported",
      createdAt: new Date().toISOString()
    };
  }

  importImageBuffer(
    fileName: string,
    content: Buffer,
    role: ImageAsset["role"] = "cover"
  ): ImageAsset {
    const extension = extname(fileName).toLowerCase();
    if (!supportedImageExtensions.has(extension)) {
      throw new Error("Unsupported image format.");
    }

    mkdirSync(this.paths.images, { recursive: true });
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const cleanName = sanitizeFileName(basename(fileName, extension));
    const destination = join(this.paths.images, `${hash}-${cleanName || "image"}${extension}`);
    writeFileSync(destination, content);

    const localPath = toLocalPath(this.paths.root, destination);
    return {
      id: `image_${randomUUID().replace(/-/g, "")}`,
      localPath,
      url: mediaUrl(localPath),
      role,
      altText: fileName,
      source: "imported",
      createdAt: new Date().toISOString()
    };
  }

  async pickImage(): Promise<ImageAsset | null> {
    const result = await dialog.showOpenDialog({
      title: "표지 이미지 선택",
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return this.importImage(result.filePaths[0]);
  }

  async pickImages(): Promise<ImageAsset[]> {
    const result = await dialog.showOpenDialog({
      title: "이미지 선택",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return result.filePaths.map((filePath) => this.importImage(filePath));
  }

  async searchPixabayImages({
    apiKey,
    query,
    language
  }: {
    apiKey: string;
    query: string;
    language: LanguageCode;
  }): Promise<PixabayImageOption[]> {
    const cleanKey = apiKey.trim();
    const cleanQuery = query.trim().slice(0, 100);
    if (!cleanKey) {
      throw new Error("Pixabay API key is required.");
    }

    if (!cleanQuery) {
      return [];
    }

    for (const queryOption of titleQueries(cleanQuery)) {
      for (const options of pixabaySearchAttempts(queryOption, language)) {
        const hits = await this.fetchPixabayHits(cleanKey, queryOption, options);
        if (hits.length > 0) {
          return hits.slice(0, 5).map(mapPixabayHit);
        }
      }
    }

    return [];
  }

  private async fetchPixabayHits(
    apiKey: string,
    query: string,
    options: { language: LanguageCode | ""; category: "food" | "" }
  ): Promise<PixabayHit[]> {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", query);
    if (options.language) {
      url.searchParams.set("lang", options.language);
    }
    url.searchParams.set("image_type", "photo");
    if (options.category) {
      url.searchParams.set("category", options.category);
    }
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("order", "popular");
    url.searchParams.set("per_page", "5");

    const response = await net.fetch(url.toString());
    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as PixabayResponse;
    return data.hits ?? [];
  }

  async importPixabayImage(
    image: PixabayImageOption,
    title: string
  ): Promise<ImageAsset> {
    const response = await net.fetch(image.imageUrl);
    if (!response.ok) {
      throw new Error("Could not download the Pixabay image.");
    }

    const content = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const extension = extensionForContentType(contentType) ?? extensionForUrl(image.imageUrl);
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const cleanTitle = title.trim();
    const cleanName = sanitizeFileName(cleanTitle || image.tags || "pixabay");
    const fileName = `${hash}-${cleanName || "pixabay"}${extension}`;
    mkdirSync(this.paths.images, { recursive: true });
    const destination = join(this.paths.images, fileName);
    writeFileSync(destination, content);

    const localPath = toLocalPath(this.paths.root, destination);
    return {
      id: `image_${randomUUID().replace(/-/g, "")}`,
      localPath,
      url: mediaUrl(localPath),
      role: "cover",
      altText: cleanTitle || image.tags,
      source: "pixabay",
      sourceUrl: image.pageUrl,
      attribution: `Pixabay / ${image.user}`,
      createdAt: new Date().toISOString()
    };
  }

  generateCover(recipe: Recipe): ImageAsset {
    mkdirSync(this.paths.generatedCovers, { recursive: true });
    const filename = `${recipe.id}.svg`;
    const destination = join(this.paths.generatedCovers, filename);
    const ingredientEmojis = recipe.ingredients
      .slice(0, 6)
      .map((ingredient) => ingredient.emoji)
      .join(" ");
    const svg = renderCoverSvg(recipe.title, ingredientEmojis || "🍽️");
    writeFileSync(destination, svg, "utf8");

    const localPath = toLocalPath(this.paths.root, destination);
    return {
      id: `image_${randomUUID().replace(/-/g, "")}`,
      localPath,
      url: mediaUrl(localPath),
      role: "cover",
      altText: `${recipe.title} 표지`,
      source: "generated",
      createdAt: new Date().toISOString()
    };
  }

  hydrate(asset: ImageAsset | null): ImageAsset | null {
    if (!asset) {
      return null;
    }

    return {
      ...asset,
      url: mediaUrl(asset.localPath)
    };
  }
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function extensionForContentType(contentType: string): string | null {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return null;
}

function extensionForUrl(value: string): string {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    return supportedImageExtensions.has(extension) ? extension : ".jpg";
  } catch {
    return ".jpg";
  }
}

function titleQueries(title: string): string[] {
  const compactTitle = title.replace(/\s+/g, "");
  const queries = [
    title,
    compactTitle,
    titleQueryAliases.get(title)
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(queries));
}

function pixabaySearchAttempts(
  query: string,
  fallbackLanguage: LanguageCode
): { language: LanguageCode | ""; category: "food" | "" }[] {
  const queryLanguage = /[가-힣]/.test(query) ? "ko" : "en";
  const attempts = [
    { language: queryLanguage, category: "food" },
    { language: fallbackLanguage, category: "food" },
    { language: "", category: "food" },
    { language: queryLanguage, category: "" },
    { language: "", category: "" }
  ] satisfies { language: LanguageCode | ""; category: "food" | "" }[];

  return attempts.filter((attempt, index) =>
    attempts.findIndex(
      (item) =>
        item.language === attempt.language &&
        item.category === attempt.category
    ) === index
  );
}

function mapPixabayHit(hit: PixabayHit): PixabayImageOption {
  return {
    id: hit.id,
    previewUrl: hit.previewURL,
    imageUrl: hit.largeImageURL || hit.webformatURL,
    pageUrl: hit.pageURL,
    tags: hit.tags,
    user: hit.user,
    width: hit.imageWidth || hit.webformatWidth,
    height: hit.imageHeight || hit.webformatHeight
  };
}

export function mediaUrl(localPath: string): string {
  const encoded = localPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `cookbook://media/${encoded}`;
}

function toLocalPath(root: string, fullPath: string): string {
  return relative(root, fullPath).replace(/\\/g, "/");
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

function renderCoverSvg(title: string, emojis: string): string {
  const safeTitle = escapeXml(title);
  const safeEmojis = escapeXml(emojis);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="560" viewBox="0 0 800 560" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="560" rx="44" fill="#ffffff"/>
  <rect x="36" y="36" width="728" height="488" rx="36" fill="#f8fafc" stroke="#e5e7eb" stroke-width="2"/>
  <text x="400" y="260" text-anchor="middle" font-size="68" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${safeEmojis}</text>
  <text x="400" y="366" text-anchor="middle" font-size="48" font-weight="800" font-family="'Noto Sans KR','Pretendard','Inter',sans-serif" fill="#202124">${safeTitle}</text>
  <text x="400" y="414" text-anchor="middle" font-size="22" font-family="'Noto Sans KR','Pretendard','Inter',sans-serif" fill="#5f6368">Local Korean Cookbook</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
