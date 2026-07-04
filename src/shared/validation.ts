import type { Equipment, Ingredient, InstructionStep, RecipeDraft } from "./types";
import { detectIngredientAllergens, suggestEmoji } from "./emoji";
import { canonicalUnitValue } from "./units";

export function createId(prefix = "id"): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random.replace(/-/g, "")}`;
}

export function createEmptyIngredient(order = 0): Ingredient {
  return {
    id: createId("ingredient"),
    name: "",
    quantity: "",
    unit: "",
    emoji: "🍽️",
    allergens: [],
    order
  };
}

export function createEmptyStep(order = 0): InstructionStep {
  return {
    id: createId("step"),
    order,
    text: "",
    images: []
  };
}

export function createEmptyEquipment(order = 0): Equipment {
  return {
    id: createId("equipment"),
    name: "",
    size: "medium",
    order
  };
}

export function createEmptyRecipeDraft(): RecipeDraft {
  return {
    title: "",
    aliases: [],
    timeMinutes: 30,
    spicyLevel: 1,
    difficulty: "easy",
    mealType: "dinner",
    mainProtein: "other",
    prepAhead: false,
    allergens: [],
    coverImage: null,
    coverImages: [],
    ingredients: [createEmptyIngredient(0)],
    equipment: [],
    steps: [createEmptyStep(0)],
    notes: ""
  };
}

export function normalizeDraft(draft: RecipeDraft): RecipeDraft {
  const ingredients = draft.ingredients
    .map((ingredient, index) => {
      const name = ingredient.name.trim();
      const detectedAllergens = detectIngredientAllergens(name);
      const allergens = uniqueSorted([
        ...ingredient.allergens,
        ...detectedAllergens
      ]);

      return {
        ...ingredient,
        id: ingredient.id || createId("ingredient"),
        name,
        quantity: ingredient.quantity.trim(),
        unit: canonicalUnitValue(ingredient.unit),
        emoji: ingredient.emoji.trim() || suggestEmoji(name),
        allergens,
        order: index
      };
    })
    .filter((ingredient) => ingredient.name.length > 0);

  const steps = draft.steps
    .map((step, index) => ({
      ...step,
      id: step.id || createId("step"),
      text: step.text.trim(),
      images: normalizeImages(step.images),
      order: index
    }))
    .filter((step) => step.text.length > 0 || step.images.length > 0);

  const equipment = draft.equipment
    .map((item, index) => ({
      ...item,
      id: item.id || createId("equipment"),
      name: item.name.trim(),
      size:
        item.size === "small" || item.size === "large" || item.size === "medium"
          ? item.size
          : "medium",
      order: index
    }))
    .filter((item) => item.name.length > 0);

  const allergens = uniqueSorted([
    ...draft.allergens.map((allergen) => allergen.trim()).filter(Boolean),
    ...ingredients.flatMap((ingredient) => ingredient.allergens)
  ]);

  const coverImages = normalizeImages(
    draft.coverImages && draft.coverImages.length > 0
      ? draft.coverImages
      : draft.coverImage
        ? [draft.coverImage]
        : []
  );

  return {
    ...draft,
    title: draft.title.trim() || "새 레시피",
    aliases: uniqueSorted(draft.aliases.map((alias) => alias.trim()).filter(Boolean)),
    timeMinutes: clampNumber(draft.timeMinutes, 0, 1440),
    spicyLevel: clampNumber(draft.spicyLevel, 1, 5),
    difficulty: normalizeDifficulty(draft.difficulty),
    mealType: normalizeMealType(draft.mealType),
    mainProtein: normalizeMainProtein(draft.mainProtein),
    prepAhead: Boolean(draft.prepAhead),
    allergens,
    coverImage: coverImages[0] ?? null,
    coverImages,
    ingredients,
    equipment,
    steps,
    notes: draft.notes.trim()
  };
}

function normalizeImages(value: unknown): RecipeDraft["coverImages"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is RecipeDraft["coverImages"][number] =>
      Boolean(item) &&
      typeof item === "object" &&
      "id" in item &&
      "localPath" in item &&
      "url" in item
    )
    .map((image) => ({
      ...image,
      altText: image.altText.trim(),
      role: image.role === "step" ? "step" : "cover"
    }));
}

export function validateDraft(draft: RecipeDraft): string[] {
  const normalized = normalizeDraft(draft);
  const errors: string[] = [];

  if (!normalized.title) {
    errors.push("레시피 제목을 입력해 주세요.");
  }

  if (normalized.ingredients.length === 0) {
    errors.push("재료를 한 가지 이상 입력해 주세요.");
  }

  if (normalized.steps.length === 0) {
    errors.push("조리 과정을 한 단계 이상 입력해 주세요.");
  }

  return errors;
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeDifficulty(value: RecipeDraft["difficulty"]): RecipeDraft["difficulty"] {
  return value === "medium" || value === "hard" ? value : "easy";
}

function normalizeMealType(value: RecipeDraft["mealType"]): RecipeDraft["mealType"] {
  return [
    "breakfast",
    "lunch",
    "dinner",
    "side",
    "soup",
    "snack",
    "dessert",
    "other"
  ].includes(value)
    ? value
    : "dinner";
}

function normalizeMainProtein(value: RecipeDraft["mainProtein"]): RecipeDraft["mainProtein"] {
  return [
    "beef",
    "pork",
    "chicken",
    "seafood",
    "fish",
    "tofu",
    "egg",
    "vegetable",
    "none",
    "other"
  ].includes(value)
    ? value
    : "other";
}
