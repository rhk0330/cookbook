import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { RecipeDraft } from "@shared/types";
import { parseRecipeText } from "@shared/parser";
import type { MediaService } from "./media";
import type { RecipeRepository } from "./repository";

const sampleCoverFiles = new Map<string, string>([
  ["김치볶음밥", "8a87eb2a80b69ef1-김치볶음밥.jpg"],
  ["된장찌개", "a08860bdb9fd8112-된장찌개.jpg"],
  ["매콤 오이무침", "5aacb0f879844f59-매콤-오이무침.jpg"],
  ["Bibimbap", "0e5ddaaa974e104a-Bibimbap.jpg"],
  ["Bulgogi", "f706f0aeab3fdb94-Bulgogi.jpg"],
  ["Japchae", "08758268cee082b8-Japchae.jpg"],
  ["Tteokbokki", "f5543b6a3d44e6e9-Tteokbokki.jpg"],
  ["Haemul Pajeon", "d92975171fb40a62-Haemul-Pajeon.jpg"],
  ["Sundubu Jjigae", "cf6b3b65ca6a4887-Sundubu-Jjigae.jpg"],
  ["Galbi Jjim", "a242ba7c969f4984-Galbi-Jjim.jpg"],
  ["Jeyuk Bokkeum", "cf14bf59d64b3320-Jeyuk-Bokkeum.jpg"],
  ["Kimbap", "f16acb5a38dad8dc-Kimbap.jpg"],
  ["Dakdoritang", "880dc976921bfce4-Dakdoritang.jpg"],
  ["Miyeok Guk", "5adcf03f7c8021d7-Miyeok-Guk.jpg"],
  ["Mandu Guk", "8f9e04f3e0870996-Mandu-Guk.jpg"],
  ["Bossam", "029d465833f792fc-Bossam.jpg"],
  ["Kimchi Jjigae", "211a2362684de80c-Kimchi-Jjigae.jpg"],
  ["Hotteok", "f1b0387bf6582c3e-Hotteok.jpg"]
]);

const seedTexts = [
  `김치볶음밥
조리시간: 20분
재료
- 밥 2컵
- 김치 1컵
- 계란 1개
- 대파 1쪽
- 간장 1큰술
만드는 법
1. 대파를 송송 썰고 김치는 먹기 좋게 자른다.
2. 팬에 기름을 두르고 대파를 볶아 향을 낸다.
3. 김치를 넣고 볶다가 밥과 간장을 넣어 고루 섞는다.
4. 계란 프라이를 올려 완성한다.`,
  `된장찌개
조리시간: 35분
알레르기: 대두
재료
- 된장 2큰술
- 두부 1모
- 감자 1개
- 양파 1/2개
- 버섯 1컵
- 대파 1쪽
만드는 법
1. 냄비에 물을 붓고 된장을 풀어 끓인다.
2. 감자와 양파를 넣고 부드러워질 때까지 끓인다.
3. 두부와 버섯을 넣고 한소끔 더 끓인다.
4. 마지막에 대파를 올린다.`,
  `매콤 오이무침
time: 15 minutes
ingredients
- 오이 2개
- 고춧가루 1큰술
- 마늘 1작은술
- 참깨 1작은술
- 간장 1큰술
instructions
1. 오이를 얇게 썰어 소금에 살짝 절인다.
2. 물기를 제거하고 양념을 넣어 버무린다.
3. 참깨를 뿌려 바로 낸다.`
];

const englishSeedTexts = [
  `Bibimbap
time: 35 minutes
allergens: egg, soy, sesame
ingredients
- cooked rice 2 cups
- spinach 1 cup
- carrots 1/2 cup
- bean sprouts 1 cup
- ground beef 150g
- egg 1
- gochujang 2 tbsp
- sesame oil 1 tbsp
equipment
- skillet - medium
- mixing bowl - medium
instructions
1. Saute the vegetables separately with a little oil and salt.
2. Brown the beef with soy sauce and a small spoon of sesame oil.
3. Fry the egg sunny-side up.
4. Add rice to a bowl and arrange vegetables, beef, egg, and gochujang on top.
5. Mix just before eating.
notes
Mock recipe for testing the cookbook layout.`,
  `Bulgogi
time: 45 minutes
allergens: soy, sesame
ingredients
- thin sliced beef 500g
- soy sauce 4 tbsp
- sugar 2 tbsp
- pear juice 1/4 cup
- garlic 3 cloves
- onion 1/2
- sesame oil 1 tbsp
- green onion 1 stalk
equipment
- skillet - large
- mixing bowl - medium
instructions
1. Mix soy sauce, sugar, pear juice, garlic, and sesame oil.
2. Marinate beef and sliced onion for at least 20 minutes.
3. Cook in a hot skillet until the beef is browned and glossy.
4. Finish with green onion and serve with rice.
notes
Mock recipe with a short marinade.`,
  `Japchae
time: 50 minutes
allergens: soy, sesame
ingredients
- sweet potato noodles 300g
- spinach 1 cup
- carrot 1
- onion 1/2
- mushrooms 1 cup
- soy sauce 4 tbsp
- sesame oil 2 tbsp
- sugar 1 tbsp
equipment
- pot - large
- wok - large
instructions
1. Boil noodles until chewy, then rinse and drain.
2. Stir-fry vegetables separately so each keeps its texture.
3. Toss noodles with soy sauce, sugar, and sesame oil.
4. Combine vegetables and noodles in a large pan.
5. Serve warm or at room temperature.
notes
Mock party noodle recipe.`,
  `Tteokbokki
time: 30 minutes
allergens: fish, soy, wheat
ingredients
- rice cakes 500g
- fish cakes 2 sheets
- gochujang 3 tbsp
- gochugaru 1 tbsp
- sugar 2 tbsp
- soy sauce 1 tbsp
- cabbage 1 cup
- green onion 1 stalk
equipment
- shallow pan - large
instructions
1. Simmer gochujang, gochugaru, sugar, and soy sauce in water.
2. Add rice cakes and stir until they soften.
3. Add fish cakes and cabbage.
4. Simmer until the sauce thickens.
5. Finish with green onion.
notes
Mock spicy street food recipe.`,
  `Haemul Pajeon
time: 35 minutes
allergens: shellfish, egg, wheat
ingredients
- pancake mix 1 cup
- water 3/4 cup
- egg 1
- scallions 8
- mixed seafood 1 cup
- soy dipping sauce 2 tbsp
equipment
- skillet - large
- mixing bowl - medium
instructions
1. Mix pancake mix, water, and egg into a loose batter.
2. Lay scallions and seafood in a hot oiled skillet.
3. Pour batter over the filling.
4. Cook until crisp, then flip carefully.
5. Slice and serve with dipping sauce.
notes
Mock seafood pancake recipe.`,
  `Sundubu Jjigae
time: 25 minutes
allergens: soy, egg, shellfish
ingredients
- soft tofu 1 package
- kimchi 1/2 cup
- gochugaru 1 tbsp
- garlic 2 cloves
- anchovy broth 2 cups
- egg 1
- green onion 1 stalk
equipment
- small pot - medium
instructions
1. Saute kimchi, garlic, and gochugaru briefly.
2. Add broth and bring to a simmer.
3. Spoon in soft tofu in large pieces.
4. Crack in an egg and simmer until just set.
5. Finish with green onion.
notes
Mock soft tofu stew recipe.`,
  `Galbi Jjim
time: 2 hours
allergens: soy, sesame
ingredients
- beef short ribs 1kg
- soy sauce 1/2 cup
- sugar 3 tbsp
- garlic 5 cloves
- radish 1 cup
- carrots 1 cup
- mushrooms 1 cup
- sesame oil 1 tbsp
equipment
- dutch oven - large
instructions
1. Blanch ribs, rinse, and place in a heavy pot.
2. Add soy sauce, sugar, garlic, and enough water to mostly cover.
3. Simmer until the ribs are tender.
4. Add radish, carrots, and mushrooms.
5. Reduce the sauce until glossy.
notes
Mock braised short rib recipe.`,
  `Jeyuk Bokkeum
time: 40 minutes
allergens: soy, sesame
ingredients
- pork shoulder 500g
- gochujang 2 tbsp
- gochugaru 1 tbsp
- soy sauce 2 tbsp
- garlic 3 cloves
- onion 1
- cabbage 1 cup
- sesame oil 1 tbsp
equipment
- wok - large
instructions
1. Mix pork with gochujang, gochugaru, soy sauce, garlic, and sesame oil.
2. Rest for 15 minutes.
3. Stir-fry pork over high heat.
4. Add onion and cabbage and cook until tender.
5. Serve with lettuce and rice.
notes
Mock spicy pork recipe.`,
  `Kimbap
time: 45 minutes
allergens: egg, sesame, fish
ingredients
- cooked rice 3 cups
- seaweed sheets 5
- egg 2
- carrot 1
- spinach 1 cup
- pickled radish 5 strips
- imitation crab 5 sticks
- sesame oil 1 tbsp
equipment
- bamboo mat - small
- skillet - medium
instructions
1. Season rice with sesame oil and salt.
2. Cook egg into a thin sheet and slice into strips.
3. Prepare carrots, spinach, radish, and crab.
4. Spread rice on seaweed and add fillings.
5. Roll tightly and slice.
notes
Mock picnic roll recipe.`,
  `Dakdoritang
time: 1 hour
allergens: soy
ingredients
- chicken pieces 1kg
- potatoes 2
- carrot 1
- onion 1
- gochujang 2 tbsp
- gochugaru 1 tbsp
- soy sauce 3 tbsp
- garlic 4 cloves
equipment
- pot - large
instructions
1. Add chicken, potatoes, carrot, onion, and sauce ingredients to a pot.
2. Add water until ingredients are half covered.
3. Simmer until chicken is cooked through.
4. Reduce until the sauce is rich and clings to the potatoes.
5. Serve hot with rice.
notes
Mock spicy braised chicken recipe.`,
  `Miyeok Guk
time: 35 minutes
allergens: soy, shellfish
ingredients
- dried seaweed 1/2 cup
- beef brisket 150g
- garlic 2 cloves
- soup soy sauce 2 tbsp
- sesame oil 1 tbsp
- water 6 cups
equipment
- soup pot - large
instructions
1. Soak seaweed until soft, then drain.
2. Saute beef and seaweed in sesame oil.
3. Add garlic, soup soy sauce, and water.
4. Simmer until the broth is savory.
5. Adjust seasoning before serving.
notes
Mock seaweed soup recipe.`,
  `Mandu Guk
time: 30 minutes
allergens: egg, wheat, soy
ingredients
- dumplings 12
- beef broth 5 cups
- egg 1
- green onion 1 stalk
- garlic 1 clove
- soy sauce 1 tbsp
- roasted seaweed 1 sheet
equipment
- soup pot - medium
instructions
1. Bring broth, garlic, and soy sauce to a simmer.
2. Add dumplings and cook until they float.
3. Drizzle in beaten egg.
4. Garnish with green onion and roasted seaweed.
5. Serve immediately.
notes
Mock dumpling soup recipe.`,
  `Bossam
time: 1 hour 30 minutes
allergens: soy
ingredients
- pork belly 1kg
- doenjang 2 tbsp
- garlic 6 cloves
- ginger 3 slices
- onion 1
- napa cabbage leaves 12
- ssamjang 1/2 cup
equipment
- stock pot - large
instructions
1. Simmer pork belly with doenjang, garlic, ginger, and onion.
2. Cook until tender.
3. Rest the pork, then slice thickly.
4. Serve with cabbage leaves and ssamjang.
5. Wrap pork with cabbage before eating.
notes
Mock boiled pork wrap recipe.`,
  `Kimchi Jjigae
time: 40 minutes
allergens: soy, fish
ingredients
- aged kimchi 2 cups
- pork belly 250g
- tofu 1 block
- onion 1/2
- gochugaru 1 tbsp
- kimchi brine 1/2 cup
- water 3 cups
- green onion 1 stalk
equipment
- pot - medium
instructions
1. Saute pork belly and kimchi until fragrant.
2. Add kimchi brine, gochugaru, and water.
3. Simmer until the kimchi is soft.
4. Add tofu and onion.
5. Finish with green onion.
notes
Mock kimchi stew recipe.`,
  `Hotteok
time: 1 hour
allergens: wheat, peanut
ingredients
- flour 2 cups
- warm water 3/4 cup
- yeast 1 tsp
- sugar 2 tbsp
- brown sugar 1/2 cup
- cinnamon 1 tsp
- chopped peanuts 1/4 cup
equipment
- skillet - medium
- mixing bowl - medium
instructions
1. Mix flour, yeast, sugar, and warm water into a soft dough.
2. Rest until slightly puffy.
3. Fill small dough rounds with brown sugar, cinnamon, and peanuts.
4. Pan-fry and press flat until golden.
5. Cool slightly before eating.
notes
Mock sweet pancake recipe.`
];

export function seedRecipesIfNeeded(
  repository: RecipeRepository,
  mediaService: MediaService
): void {
  const existingTitles = new Set(
    repository.list().map((recipe) => recipe.title.trim().toLowerCase())
  );

  for (const text of [...seedTexts, ...englishSeedTexts]) {
    const parsed = parseRecipeText(text);
    const titleKey = parsed.draft.title.trim().toLowerCase();
    if (!titleKey || existingTitles.has(titleKey)) {
      continue;
    }

    const draft: RecipeDraft = {
      ...parsed.draft,
      coverImage: null
    };
    const recipe = repository.create(draft);
    const sampleCoverPath = getSampleCoverPath(recipe.title);
    const cover = sampleCoverPath
      ? mediaService.importImage(sampleCoverPath)
      : mediaService.generateCover(recipe);
    repository.setCoverImage(recipe.id, cover);
    existingTitles.add(titleKey);
  }
}

function getSampleCoverPath(title: string): string | null {
  const fileName = sampleCoverFiles.get(title.trim());
  if (!fileName) {
    return null;
  }

  const roots = [
    app.isPackaged
      ? join(process.resourcesPath, "resources", "sample-images")
      : join(process.cwd(), "resources", "sample-images"),
    join(process.cwd(), "data", "images")
  ];

  for (const root of roots) {
    const imagePath = join(root, fileName);
    if (existsSync(imagePath)) {
      return imagePath;
    }
  }

  return null;
}
