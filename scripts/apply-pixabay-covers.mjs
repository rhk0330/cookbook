import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative } from "node:path";
import initSqlJs from "sql.js";

const workspaceRoot = process.cwd();
const dataRoot = join(workspaceRoot, "data");
const databasePath = join(dataRoot, "cookbook.sqlite");
const imagesDir = join(dataRoot, "images");
const keyFilePath = join(dataRoot, "pixabay-api-key.txt");

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const titleQueryAliases = new Map([
  ["Haemul Pajeon", "해물파전"],
  ["Jeyuk Bokkeum", "제육볶음"],
  ["Dakdoritang", "닭도리탕"],
  ["Galbi Jjim", "갈비찜"],
  ["Miyeok Guk", "미역국"]
]);

function getSeedTitles() {
  const seedSource = readFileSync(join(workspaceRoot, "src/main/seed.ts"), "utf8");
  return Array.from(seedSource.matchAll(/`([\s\S]*?)`/g))
    .map((match) => match[1].split(/\r?\n/).map((line) => line.trim()).find(Boolean))
    .filter(Boolean);
}

function mediaUrl(localPath) {
  const encoded = localPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `cookbook://media/${encoded}`;
}

function sanitizeFileName(value) {
  return value
    .replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function extensionForContentType(contentType) {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return null;
}

function extensionForUrl(value) {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    return supportedImageExtensions.has(extension) ? extension : ".jpg";
  } catch {
    return ".jpg";
  }
}

function readRows(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function readSetting(db, key) {
  const rows = readRows(db, "SELECT value FROM settings WHERE key = ?", [key]);
  return String(rows[0]?.value ?? "").trim();
}

async function fetchFirstPixabayHit(apiKey, title) {
  for (const query of titleQueries(title)) {
    const language = /[가-힣]/.test(query) ? "ko" : "en";
    const attempts = [
      { language, category: "food" },
      { language, category: "" },
      { language: "", category: "food" },
      { language: "", category: "" }
    ];

    for (const attempt of attempts) {
      const url = new URL("https://pixabay.com/api/");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("q", query);
      if (attempt.language) {
        url.searchParams.set("lang", attempt.language);
      }
      url.searchParams.set("image_type", "photo");
      if (attempt.category) {
        url.searchParams.set("category", attempt.category);
      }
      url.searchParams.set("safesearch", "true");
      url.searchParams.set("order", "popular");
      url.searchParams.set("per_page", "5");

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pixabay search failed for "${title}": ${response.status}`);
      }

      const data = await response.json();
      const hit = data.hits?.[0] ?? null;
      if (hit) {
        return hit;
      }
    }
  }

  return null;
}

function titleQueries(title) {
  const compactTitle = title.replace(/\s+/g, "");
  return Array.from(new Set([
    title,
    compactTitle,
    titleQueryAliases.get(title)
  ].filter(Boolean)));
}

async function downloadPixabayImage(hit, title) {
  const imageUrl = hit.largeImageURL || hit.webformatURL;
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Pixabay image download failed for "${title}": ${response.status}`);
  }

  const content = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "";
  const extension = extensionForContentType(contentType) ?? extensionForUrl(imageUrl);
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const fileName = `${hash}-${sanitizeFileName(title) || "pixabay"}${extension}`;
  const destination = join(imagesDir, fileName);
  writeFileSync(destination, content);

  const localPath = relative(dataRoot, destination).replace(/\\/g, "/");
  return {
    id: `image_${randomUUID().replace(/-/g, "")}`,
    localPath,
    url: mediaUrl(localPath),
    role: "cover",
    altText: title,
    source: "pixabay",
    sourceUrl: hit.pageURL,
    attribution: `Pixabay / ${hit.user}`,
    createdAt: new Date().toISOString()
  };
}

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database(new Uint8Array(readFileSync(databasePath)));

const apiKeyFromSettings = readSetting(db, "pixabayApiKey");
const apiKeyFromFile = existsSync(keyFilePath) ? readFileSync(keyFilePath, "utf8").trim() : "";
const apiKey = apiKeyFromSettings || apiKeyFromFile;
if (!apiKey) {
  throw new Error("Missing Pixabay API key in settings or data/pixabay-api-key.txt.");
}

mkdirSync(imagesDir, { recursive: true });

const seedTitleSet = new Set(getSeedTitles().map((title) => title.toLowerCase()));
const recipes = readRows(
  db,
  "SELECT id, title, cover_image_json FROM recipes ORDER BY created_at ASC"
);
const targets = recipes.filter((recipe) => seedTitleSet.has(String(recipe.title).toLowerCase()));
const summary = {
  seedTitles: seedTitleSet.size,
  targets: targets.length,
  updated: 0,
  skippedExisting: 0,
  noResult: []
};

for (const recipe of targets) {
  const title = String(recipe.title);
  const cover = recipe.cover_image_json ? JSON.parse(String(recipe.cover_image_json)) : null;
  if (cover && cover.source !== "generated") {
    summary.skippedExisting += 1;
    continue;
  }

  const hit = await fetchFirstPixabayHit(apiKey, title);
  if (!hit) {
    summary.noResult.push(title);
    continue;
  }

  const asset = await downloadPixabayImage(hit, title);
  db.run("UPDATE recipes SET cover_image_json = ? WHERE id = ?", [
    JSON.stringify(asset),
    recipe.id
  ]);
  summary.updated += 1;
  console.log(`Updated ${title}`);
}

writeFileSync(databasePath, Buffer.from(db.export()));
db.close();

console.log(JSON.stringify(summary, null, 2));
