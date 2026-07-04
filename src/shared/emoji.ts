import { allergenDictionary, ingredientDictionary } from "./dictionaries";

const categoryFallbacks: Record<string, string> = {
  protein: "🍽️",
  vegetable: "🥬",
  spice: "🌶️",
  grain: "🍚",
  dairy: "🥛",
  seafood: "🐟",
  nut: "🥜",
  seed: "🌱",
  sauce: "🫙"
};

export function suggestEmoji(name: string): string {
  const normalizedName = normalizeLoose(name);
  const exact = ingredientDictionary.find((entry) =>
    entry.aliases.some((alias) => normalizeLoose(alias) === normalizedName)
  );

  if (exact) {
    return exact.emoji;
  }

  const partial = ingredientDictionary.find((entry) =>
    entry.aliases.some((alias) => {
      const normalizedAlias = normalizeLoose(alias);
      return (
        normalizedName.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedName)
      );
    })
  );

  if (partial) {
    return partial.emoji || categoryFallbacks[partial.category] || "🍽️";
  }

  return "🍽️";
}

export function detectIngredientAllergens(name: string): string[] {
  const normalizedName = normalizeLoose(name);
  const detected = new Set<string>();

  for (const ingredient of ingredientDictionary) {
    const matches = ingredient.aliases.some((alias) => {
      const normalizedAlias = normalizeLoose(alias);
      return (
        normalizedName.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedName)
      );
    });

    if (matches) {
      for (const allergen of ingredient.allergens) {
        detected.add(allergen);
      }
    }
  }

  for (const allergen of allergenDictionary) {
    const matches = allergen.aliases.some((alias) =>
      normalizedName.includes(normalizeLoose(alias))
    );

    if (matches) {
      detected.add(allergen.id);
    }
  }

  return [...detected].sort();
}

export function normalizeLoose(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()[\]{}.,:;'"`~!@#$%^&*_+=\\/|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
