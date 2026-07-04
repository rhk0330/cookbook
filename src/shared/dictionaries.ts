import allergensJson from "../../resources/dictionaries/allergens.json";
import ingredientsJson from "../../resources/dictionaries/ingredients.json";

export interface IngredientDictionaryEntry {
  emoji: string;
  category: string;
  allergens: string[];
  aliases: string[];
}

export interface AllergenDictionaryEntry {
  id: string;
  labelKo: string;
  labelEn: string;
  aliases: string[];
}

export const ingredientDictionary =
  ingredientsJson as IngredientDictionaryEntry[];

export const allergenDictionary = allergensJson as AllergenDictionaryEntry[];

export const difficultyLabels: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움"
};

export const allergenLabelKo = (id: string): string => {
  return allergenDictionary.find((allergen) => allergen.id === id)?.labelKo ?? id;
};
