import { mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { RecipeRepository } from "../src/main/repository";
import { parseRecipeText } from "@shared/parser";
import type { DataPaths } from "../src/main/paths";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("RecipeRepository", () => {
  it("persists recipes, search text, and settings in a SQLite file", async () => {
    const paths = await createTempDataPaths();
    const repository = await RecipeRepository.open(paths);
    const parsed = parseRecipeText(`두부조림
조리시간: 25분
재료
- 두부 1모
- 간장 2큰술
만드는 법
1. 두부를 굽는다.
2. 양념장을 넣고 조린다.`);

    parsed.draft.equipment = [
      {
        id: "equipment_wok",
        name: "wok",
        size: "medium",
        order: 0
      }
    ];

    const created = repository.create(parsed.draft);
    const listed = repository.list();

    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("두부조림");
    expect(listed[0].equipment[0].name).toBe("wok");
    expect(repository.search("tofu")[0].id).toBe(created.id);

    const settings = repository.updateSettings({
      tileSize: 4,
      language: "ko",
      pixabayApiKey: "free-test-key",
      unitSystem: "imperial",
      theme: "dark",
      accentColor: "green",
      lastIngredientUnit: "oz",
      customUnits: ["pinch", "bundle", "pinch"],
      hiddenUnits: ["tbsp", "cup", "tbsp"],
      recentEmojis: ["🥬", "🥚", "🥬", ""]
    });
    expect(settings.tileSize).toBe(4);
    expect(settings.pixabayApiKey).toBe("free-test-key");
    expect(settings.unitSystem).toBe("imperial");
    expect(settings.theme).toBe("dark");
    expect(settings.accentColor).toBe("green");
    expect(settings.lastIngredientUnit).toBe("oz");
    expect(settings.customUnits).toEqual(["pinch", "bundle"]);
    expect(settings.hiddenUnits).toEqual(["tbsp", "cup"]);
    expect(settings.recentEmojis).toEqual(["🥬", "🥚"]);

    repository.close();

    const reopened = await RecipeRepository.open(paths);
    expect(reopened.get(created.id)?.title).toBe("두부조림");
    expect(reopened.get(created.id)?.equipment[0].size).toBe("medium");
    expect(reopened.getSettings().tileSize).toBe(4);
    expect(reopened.getSettings().pixabayApiKey).toBe("free-test-key");
    expect(reopened.getSettings().unitSystem).toBe("imperial");
    expect(reopened.getSettings().theme).toBe("dark");
    expect(reopened.getSettings().accentColor).toBe("green");
    expect(reopened.getSettings().lastIngredientUnit).toBe("oz");
    expect(reopened.getSettings().customUnits).toEqual(["pinch", "bundle"]);
    expect(reopened.getSettings().hiddenUnits).toEqual(["tbsp", "cup"]);
    expect(reopened.getSettings().recentEmojis).toEqual(["🥬", "🥚"]);
    reopened.close();
  });
});

async function createTempDataPaths(): Promise<DataPaths> {
  const root = await mkdtemp(join(tmpdir(), "cookbook-repository-"));
  tempRoots.push(root);
  const paths = {
    root,
    database: join(root, "cookbook.sqlite"),
    pixabayApiKey: join(root, "pixabay-api-key.txt"),
    images: join(root, "images"),
    generatedCovers: join(root, "generated-covers"),
    backups: join(root, "backups")
  };

  mkdirSync(paths.images, { recursive: true });
  mkdirSync(paths.generatedCovers, { recursive: true });
  mkdirSync(paths.backups, { recursive: true });
  return paths;
}
