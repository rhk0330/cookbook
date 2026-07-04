import { describe, expect, it } from "vitest";
import { suggestEmoji } from "@shared/emoji";
import { parseRecipeText, extractTimeMinutes } from "@shared/parser";
import { buildRecipeSearchText, recipeMatchesQuery } from "@shared/search";

describe("local Korean and English recipe parsing", () => {
  it("extracts Korean sections, ingredients, time, spice, and allergens", () => {
    const parsed = parseRecipeText(`김치볶음밥
조리시간: 20분
재료
- 밥 2컵
- 김치 1컵
- 계란 1개
- 고추장 1큰술
만드는 법
1. 김치를 볶는다.
2. 밥과 고추장을 넣어 섞는다.`);

    expect(parsed.draft.title).toBe("김치볶음밥");
    expect(parsed.draft.timeMinutes).toBe(20);
    expect(parsed.draft.ingredients).toHaveLength(4);
    expect(parsed.draft.ingredients[2].emoji).toBe("🥚");
    expect(parsed.draft.allergens).toContain("egg");
    expect(parsed.draft.spicyLevel).toBeGreaterThanOrEqual(3);
    expect(parsed.draft.steps).toHaveLength(2);
  });

  it("extracts English labels and hour/minute time values", () => {
    const parsed = parseRecipeText(`Soy garlic noodles
time: 1 hour 15 minutes
ingredients
- noodles 200g
- soy sauce 2 tbsp
- garlic 3 cloves
equipment
- wok - medium
instructions
1. Boil noodles.
2. Toss with sauce.`);

    expect(parsed.draft.title).toBe("Soy garlic noodles");
    expect(parsed.draft.timeMinutes).toBe(75);
    expect(parsed.draft.allergens).toEqual(expect.arrayContaining(["soy", "wheat"]));
    expect(parsed.draft.equipment[0]).toMatchObject({
      name: "wok",
      size: "medium"
    });
  });

  it("handles standalone time extraction", () => {
    expect(extractTimeMinutes("약 35분")).toBe(35);
    expect(extractTimeMinutes("2 hours 5 minutes")).toBe(125);
  });
});

describe("emoji fallback and Hangul-aware search", () => {
  it("suggests closest emoji for Korean eggplant", () => {
    expect(suggestEmoji("한국 가지")).toBe("🍆");
  });

  it("matches full Korean text and initial consonants", () => {
    const parsed = parseRecipeText(`된장찌개
조리시간: 35분
재료
- 된장 2큰술
- 두부 1모
만드는 법
1. 된장을 풀어 끓인다.`);
    const recipe = {
      id: "recipe_test",
      title: parsed.draft.title,
      aliases: [],
      timeMinutes: parsed.draft.timeMinutes,
      spicyLevel: parsed.draft.spicyLevel,
      difficulty: parsed.draft.difficulty,
      mealType: parsed.draft.mealType,
      mainProtein: parsed.draft.mainProtein,
      prepAhead: parsed.draft.prepAhead,
      allergens: parsed.draft.allergens,
      coverImage: null,
      ingredients: parsed.draft.ingredients,
      equipment: [],
      steps: parsed.draft.steps,
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      searchText: ""
    };
    const indexedRecipe = {
      ...recipe,
      searchText: buildRecipeSearchText(recipe)
    };

    expect(recipeMatchesQuery(indexedRecipe, "된장")).toBe(true);
    expect(recipeMatchesQuery(indexedRecipe, "ㄷㅈㅉㄱ")).toBe(true);
    expect(recipeMatchesQuery(indexedRecipe, "tofu")).toBe(true);
  });
});
