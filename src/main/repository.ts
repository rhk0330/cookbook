import initSqlJs, { type Database, type SqlValue } from "sql.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { AppSettings, ImageAsset, Recipe, RecipeDraft } from "@shared/types";
import { buildRecipeSearchText, recipeMatchesQuery } from "@shared/search";
import { createId, normalizeDraft } from "@shared/validation";
import type { DataPaths } from "./paths";
import { mediaUrl } from "./media";

interface RecipeRow {
  id: string;
  title: string;
  aliases_json: string;
  time_minutes: number;
  spicy_level: number;
  difficulty: Recipe["difficulty"];
  meal_type: Recipe["mealType"];
  main_protein: Recipe["mainProtein"];
  prep_ahead: number;
  allergens_json: string;
  cover_image_json: string | null;
  ingredients_json: string;
  equipment_json: string;
  steps_json: string;
  notes: string;
  search_text: string;
  created_at: string;
  updated_at: string;
}

const defaultSettings: AppSettings = {
  tileSize: 3,
  language: "ko",
  pixabayApiKey: "",
  unitSystem: "metric",
  theme: "light",
  accentColor: "blue",
  lastIngredientUnit: "",
  recentEmojis: []
};

export class RecipeRepository {
  private readonly db: Database;

  private constructor(
    private readonly paths: DataPaths,
    db: Database
  ) {
    this.db = db;
    this.migrate();
  }

  static async open(paths: DataPaths): Promise<RecipeRepository> {
    const require = createRequire(import.meta.url);
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const SQL = await initSqlJs({
      locateFile: () => wasmPath
    });
    const db = existsSync(paths.database)
      ? new SQL.Database(new Uint8Array(readFileSync(paths.database)))
      : new SQL.Database();

    return new RecipeRepository(paths, db);
  }

  list(): Recipe[] {
    const rows = this.selectAll<RecipeRow>(
      "SELECT * FROM recipes ORDER BY updated_at DESC"
    );
    return rows.map(mapRecipeRow);
  }

  count(): number {
    const row = this.selectOne<{ count: number }>("SELECT COUNT(*) as count FROM recipes");
    return row?.count ?? 0;
  }

  search(query: string): Recipe[] {
    return this.list().filter((recipe) => recipeMatchesQuery(recipe, query));
  }

  get(id: string): Recipe | null {
    const row = this.selectOne<RecipeRow>("SELECT * FROM recipes WHERE id = ?", [id]);
    return row ? mapRecipeRow(row) : null;
  }

  create(draft: RecipeDraft): Recipe {
    const now = new Date().toISOString();
    const recipe = buildRecipe({
      id: createId("recipe"),
      draft,
      createdAt: now,
      updatedAt: now
    });

    this.db.run(
      `INSERT INTO recipes (
        id,
        title,
        aliases_json,
        time_minutes,
        spicy_level,
        difficulty,
        meal_type,
        main_protein,
        prep_ahead,
        allergens_json,
        cover_image_json,
        ingredients_json,
        equipment_json,
        steps_json,
        notes,
        search_text,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      toRecipeValues(recipe)
    );
    this.save();

    return recipe;
  }

  update(id: string, draft: RecipeDraft): Recipe {
    const existing = this.get(id);
    if (!existing) {
      throw new Error("레시피를 찾을 수 없습니다.");
    }

    const recipe = buildRecipe({
      id,
      draft,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    });

    this.db.run(
      `UPDATE recipes SET
        title = ?,
        aliases_json = ?,
        time_minutes = ?,
        spicy_level = ?,
        difficulty = ?,
        meal_type = ?,
        main_protein = ?,
        prep_ahead = ?,
        allergens_json = ?,
        cover_image_json = ?,
        ingredients_json = ?,
        equipment_json = ?,
        steps_json = ?,
        notes = ?,
        search_text = ?,
        created_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [...toRecipeValues(recipe).slice(1), recipe.id]
    );
    this.save();

    return recipe;
  }

  delete(id: string): void {
    this.db.run("DELETE FROM recipes WHERE id = ?", [id]);
    this.save();
  }

  setCoverImage(id: string, coverImage: ImageAsset): Recipe {
    const recipe = this.get(id);
    if (!recipe) {
      throw new Error("레시피를 찾을 수 없습니다.");
    }

    return this.update(id, {
      title: recipe.title,
      aliases: recipe.aliases,
      timeMinutes: recipe.timeMinutes,
      spicyLevel: recipe.spicyLevel,
      difficulty: recipe.difficulty,
      mealType: recipe.mealType,
      mainProtein: recipe.mainProtein,
      prepAhead: recipe.prepAhead,
      allergens: recipe.allergens,
      coverImage,
      ingredients: recipe.ingredients,
      equipment: recipe.equipment,
      steps: recipe.steps,
      notes: recipe.notes
    });
  }

  getSettings(): AppSettings {
    const rows = this.selectAll<{
      key: keyof AppSettings;
      value: string;
    }>("SELECT key, value FROM settings");
    const settings = { ...defaultSettings };

    for (const row of rows) {
      if (row.key === "tileSize") {
        settings.tileSize = normalizeTileColumns(Number(row.value));
      }

      if (row.key === "language" && (row.value === "ko" || row.value === "en")) {
        settings.language = row.value;
      }

      if (row.key === "pixabayApiKey") {
        settings.pixabayApiKey = row.value;
      }

      if (row.key === "unitSystem" && (row.value === "metric" || row.value === "imperial")) {
        settings.unitSystem = row.value;
      }

      if (row.key === "theme" && (row.value === "light" || row.value === "dark")) {
        settings.theme = row.value;
      }

      if (
        row.key === "accentColor" &&
        ["blue", "green", "red", "yellow"].includes(row.value)
      ) {
        settings.accentColor = row.value as AppSettings["accentColor"];
      }

      if (row.key === "lastIngredientUnit") {
        settings.lastIngredientUnit = row.value;
      }

      if (row.key === "recentEmojis") {
        settings.recentEmojis = normalizeRecentEmojis(
          parseJson<string[]>(row.value, [])
        );
      }
    }

    return settings;
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const next = {
      ...this.getSettings(),
      ...patch
    };

    next.tileSize = normalizeTileColumns(next.tileSize);
    next.language = next.language === "en" ? "en" : "ko";
    next.pixabayApiKey = typeof next.pixabayApiKey === "string"
      ? next.pixabayApiKey.trim()
      : "";
    next.unitSystem = next.unitSystem === "imperial" ? "imperial" : "metric";
    next.theme = next.theme === "dark" ? "dark" : "light";
    next.accentColor = ["blue", "green", "red", "yellow"].includes(next.accentColor)
      ? next.accentColor
      : "blue";
    next.lastIngredientUnit = typeof next.lastIngredientUnit === "string"
      ? next.lastIngredientUnit.trim()
      : "";
    next.recentEmojis = normalizeRecentEmojis(next.recentEmojis);

    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["tileSize", String(next.tileSize)]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["language", next.language]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["pixabayApiKey", next.pixabayApiKey]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["unitSystem", next.unitSystem]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["theme", next.theme]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["accentColor", next.accentColor]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["lastIngredientUnit", next.lastIngredientUnit]
    );
    this.db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["recentEmojis", JSON.stringify(next.recentEmojis)]
    );
    this.save();

    return next;
  }

  replaceAll(recipes: Recipe[]): Recipe[] {
    try {
      this.db.run("BEGIN TRANSACTION");
      this.db.run("DELETE FROM recipes");

      for (const item of recipes) {
        const recipeWithEquipment = {
          ...item,
          equipment: item.equipment ?? []
        };
        const recipe = {
          ...recipeWithEquipment,
          searchText: buildRecipeSearchText(recipeWithEquipment)
        };
        this.db.run(
          `INSERT INTO recipes (
          id,
          title,
          aliases_json,
          time_minutes,
          spicy_level,
          difficulty,
          meal_type,
          main_protein,
          prep_ahead,
          allergens_json,
          cover_image_json,
          ingredients_json,
          equipment_json,
          steps_json,
          notes,
          search_text,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          toRecipeValues(recipe)
        );
      }

      this.db.run("COMMIT");
      this.save();
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }

    return this.list();
  }

  close(): void {
    this.save();
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        aliases_json TEXT NOT NULL DEFAULT '[]',
        time_minutes INTEGER NOT NULL DEFAULT 0,
        spicy_level INTEGER NOT NULL DEFAULT 0,
        difficulty TEXT NOT NULL DEFAULT 'easy',
        meal_type TEXT NOT NULL DEFAULT 'dinner',
        main_protein TEXT NOT NULL DEFAULT 'other',
        prep_ahead INTEGER NOT NULL DEFAULT 0,
        allergens_json TEXT NOT NULL DEFAULT '[]',
        cover_image_json TEXT,
        ingredients_json TEXT NOT NULL DEFAULT '[]',
        equipment_json TEXT NOT NULL DEFAULT '[]',
        steps_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_updated_at
        ON recipes(updated_at);
    `);
    this.db.run("PRAGMA user_version = 1");
    this.ensureColumn("recipes", "equipment_json", "TEXT NOT NULL DEFAULT '[]'");
    this.ensureColumn("recipes", "meal_type", "TEXT NOT NULL DEFAULT 'dinner'");
    this.ensureColumn("recipes", "main_protein", "TEXT NOT NULL DEFAULT 'other'");
    this.ensureColumn("recipes", "prep_ahead", "INTEGER NOT NULL DEFAULT 0");
    this.save();
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const columns = this.selectAll<{ name: string }>(`PRAGMA table_info(${table})`);
    if (columns.some((item) => item.name === column)) {
      return;
    }

    this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private selectAll<T extends object>(
    sql: string,
    params: SqlValue[] = []
  ): T[] {
    const statement = this.db.prepare(sql);
    statement.bind(params);
    const rows: T[] = [];

    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }

    statement.free();
    return rows;
  }

  private selectOne<T extends object>(
    sql: string,
    params: SqlValue[] = []
  ): T | null {
    return this.selectAll<T>(sql, params)[0] ?? null;
  }

  private save(): void {
    writeFileSync(this.paths.database, Buffer.from(this.db.export()));
  }
}

function buildRecipe({
  id,
  draft,
  createdAt,
  updatedAt
}: {
  id: string;
  draft: RecipeDraft;
  createdAt: string;
  updatedAt: string;
}): Recipe {
  const normalized = normalizeDraft(draft);
  const recipeWithoutSearch = {
    id,
    title: normalized.title,
    aliases: normalized.aliases,
    timeMinutes: normalized.timeMinutes,
    spicyLevel: normalized.spicyLevel,
    difficulty: normalized.difficulty,
    mealType: normalized.mealType,
    mainProtein: normalized.mainProtein,
    prepAhead: normalized.prepAhead,
    allergens: normalized.allergens,
    coverImage: normalized.coverImage ? hydrateImage(normalized.coverImage) : null,
    ingredients: normalized.ingredients,
    equipment: normalized.equipment,
    steps: normalized.steps,
    notes: normalized.notes,
    createdAt,
    updatedAt
  };

  return {
    ...recipeWithoutSearch,
    searchText: buildRecipeSearchText(recipeWithoutSearch)
  };
}

function mapRecipeRow(row: RecipeRow): Recipe {
  const recipe = {
    id: row.id,
    title: row.title,
    aliases: parseJson<string[]>(row.aliases_json, []),
    timeMinutes: row.time_minutes,
    spicyLevel: row.spicy_level,
    difficulty: row.difficulty,
    mealType: row.meal_type,
    mainProtein: row.main_protein,
    prepAhead: Boolean(row.prep_ahead),
    allergens: parseJson<string[]>(row.allergens_json, []),
    coverImage: hydrateImage(parseJson<ImageAsset | null>(row.cover_image_json, null)),
    ingredients: parseJson(row.ingredients_json, []),
    equipment: parseJson(row.equipment_json, []),
    steps: parseJson(row.steps_json, []),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  return {
    ...recipe,
    searchText: buildRecipeSearchText(recipe)
  };
}

function toRecipeValues(recipe: Recipe): SqlValue[] {
  return [
    recipe.id,
    recipe.title,
    JSON.stringify(recipe.aliases),
    recipe.timeMinutes,
    recipe.spicyLevel,
    recipe.difficulty,
    recipe.mealType ?? "dinner",
    recipe.mainProtein ?? "other",
    recipe.prepAhead ? 1 : 0,
    JSON.stringify(recipe.allergens),
    recipe.coverImage ? JSON.stringify(recipe.coverImage) : null,
    JSON.stringify(recipe.ingredients),
    JSON.stringify(recipe.equipment ?? []),
    JSON.stringify(recipe.steps),
    recipe.notes,
    recipe.searchText,
    recipe.createdAt,
    recipe.updatedAt
  ];
}

function hydrateImage(asset: ImageAsset | null): ImageAsset | null {
  if (!asset) {
    return null;
  }

  return {
    ...asset,
    url: mediaUrl(asset.localPath)
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeTileColumns(value: number): number {
  if (!Number.isFinite(value)) {
    return defaultSettings.tileSize;
  }

  if (value > 5) {
    return defaultSettings.tileSize;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function normalizeRecentEmojis(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )].slice(0, 24);
}
