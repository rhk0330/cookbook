import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const source = resolve("data", "pixabay-api-key.txt");
const targetDirectory = resolve("release", "win-unpacked", "data");
const target = join(targetDirectory, "pixabay-api-key.txt");

if (!existsSync(source)) {
  console.log("No local Pixabay API key found; skipping packaged key copy.");
  process.exit(0);
}

if (!existsSync(resolve("release", "win-unpacked"))) {
  console.log("Packaged app folder not found; skipping packaged key copy.");
  process.exit(0);
}

mkdirSync(targetDirectory, { recursive: true });
copyFileSync(source, target);
console.log(`Copied local Pixabay API key to ${target}`);
