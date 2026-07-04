import type { Recipe } from "./types";
import { ingredientDictionary } from "./dictionaries";

const choseong = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ"
];

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()[\]{}.,:;'"`~!@#$%^&*_+=\\/|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getHangulInitials(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 0xac00 || code > 0xd7a3) {
        return char;
      }

      const offset = code - 0xac00;
      const index = Math.floor(offset / 588);
      return choseong[index] ?? char;
    })
    .join("");
}

export function buildRecipeSearchText(recipe: Omit<Recipe, "searchText">): string {
  const chunks = [
    recipe.title,
    recipe.mealType,
    recipe.mainProtein,
    recipe.prepAhead ? "prep ahead make ahead make-ahead" : "",
    ...recipe.ingredients.flatMap((ingredient) => {
      const aliases = aliasesForIngredientName(ingredient.name);
      return [
        ingredient.name,
        ingredient.quantity,
        ingredient.unit,
        ingredient.emoji,
        ...aliases
      ];
    })
  ];

  const normalized = normalizeSearchText(chunks.join(" "));
  const initials = normalizeSearchText(getHangulInitials(chunks.join(" ")));
  return `${normalized} ${initials}`.trim();
}

export function aliasesForIngredientName(name: string): string[] {
  const normalizedName = normalizeSearchText(name);
  const aliases = new Set<string>();

  for (const entry of ingredientDictionary) {
    const matches = entry.aliases.some((alias) => {
      const normalizedAlias = normalizeSearchText(alias);
      return (
        normalizedName.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedName)
      );
    });

    if (matches) {
      for (const alias of entry.aliases) {
        aliases.add(alias);
      }
    }
  }

  return [...aliases];
}

export function recipeMatchesQuery(recipe: Recipe, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const initialsQuery = normalizeSearchText(getHangulInitials(query));
  const index = recipe.searchText || buildRecipeSearchText(recipe);
  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => index.includes(token)) || index.includes(initialsQuery);
}
