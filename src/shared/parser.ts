import type {
  Difficulty,
  Equipment,
  EquipmentSize,
  Ingredient,
  ParsedRecipe,
  RecipeDraft
} from "./types";
import {
  createEmptyRecipeDraft,
  createEmptyStep,
  createId,
  normalizeDraft,
  uniqueSorted
} from "./validation";
import { detectIngredientAllergens, suggestEmoji } from "./emoji";

type SectionName =
  | "ingredients"
  | "instructions"
  | "allergens"
  | "time"
  | "equipment"
  | "notes";

const sectionPatterns: Array<[SectionName, RegExp]> = [
  ["ingredients", /^(재료|ingredients?|材料)\s*[:：]?$/i],
  ["instructions", /^(만드는\s*법|조리\s*방법|레시피|recipe|instructions?|steps?)\s*[:：]?$/i],
  ["allergens", /^(알레르기|알러지|allergens?)\s*[:：]?$/i],
  ["time", /^(조리\s*시간|소요\s*시간|시간|time|cook\s*time|prep\s*time)\s*[:：]?$/i],
  ["equipment", /^(도구|장비|조리\s*도구|조리\s*기구|equipment|tools?)\s*[:：]?$/i],
  ["notes", /^(메모|노트|notes?)\s*[:：]?$/i]
];

const unitPattern =
  /(큰술|작은술|컵|개|장|쪽|g|kg|ml|l|tbsp|tsp|cup|cups|piece|pieces|clove|cloves)$/i;

export function parseRecipeText(sourceText: string): ParsedRecipe {
  const draft = createEmptyRecipeDraft();
  const warnings: string[] = [];
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      draft,
      confidence: 0,
      warnings: ["붙여넣은 레시피 텍스트가 비어 있습니다."],
      sourceText
    };
  }

  const firstLabelIndex = lines.findIndex((line) => getSectionCandidate(line));
  if (firstLabelIndex > 0) {
    draft.title = cleanupTitle(lines.slice(0, firstLabelIndex).join(" "));
  } else if (!getSectionCandidate(lines[0])) {
    draft.title = cleanupTitle(lines[0]);
  }

  let activeSection: SectionName | null = null;
  const buckets: Record<SectionName, string[]> = {
    ingredients: [],
    instructions: [],
    allergens: [],
    time: [],
    equipment: [],
    notes: []
  };

  for (const line of lines.slice(draft.title ? 1 : 0)) {
    const section = getSectionName(line);
    if (section) {
      activeSection = section;
      continue;
    }

    const inlineSection = getInlineSection(line);
    if (inlineSection) {
      buckets[inlineSection.section].push(inlineSection.value);
      activeSection = inlineSection.section;
      continue;
    }

    if (activeSection) {
      buckets[activeSection].push(line);
    } else if (looksLikeIngredient(line)) {
      buckets.ingredients.push(line);
    } else if (extractTimeMinutes(line) > 0) {
      buckets.time.push(line);
    } else {
      buckets.instructions.push(line);
    }
  }

  const parsedTime = extractTimeMinutes([...buckets.time, ...lines].join(" "));
  if (parsedTime > 0) {
    draft.timeMinutes = parsedTime;
  }

  const parsedIngredients = buckets.ingredients.map(parseIngredientLine);
  if (parsedIngredients.length > 0) {
    draft.ingredients = parsedIngredients;
  } else {
    warnings.push("재료 섹션을 찾지 못해 기본 재료 행을 남겼습니다.");
  }

  const parsedEquipment = buckets.equipment.map(parseEquipmentLine);
  if (parsedEquipment.length > 0) {
    draft.equipment = parsedEquipment;
  }

  const stepLines = buckets.instructions.length > 0 ? buckets.instructions : lines.slice(1);
  const steps = stepLines
    .map(cleanStep)
    .filter(Boolean)
    .map((text, index) => ({
      ...createEmptyStep(index),
      text
    }));

  if (steps.length > 0) {
    draft.steps = steps;
  } else {
    warnings.push("조리 과정이 명확하지 않아 기본 단계 행을 남겼습니다.");
  }

  draft.allergens = uniqueSorted([
    ...extractAllergenTokens(buckets.allergens.join(" ")),
    ...draft.ingredients.flatMap((ingredient) => ingredient.allergens)
  ]);
  draft.spicyLevel = inferSpicyLevel(sourceText);
  draft.difficulty = inferDifficulty(sourceText, draft.steps.length);
  draft.notes = buckets.notes.join("\n");

  const normalizedDraft = normalizeDraft(draft);
  const confidence = calculateConfidence(normalizedDraft, warnings);

  return {
    draft: normalizedDraft,
    confidence,
    warnings,
    sourceText
  };
}

export function extractTimeMinutes(text: string): number {
  const normalized = text.normalize("NFKC").toLowerCase();
  let minutes = 0;

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(시간|hours?|hrs?|h)/);
  if (hourMatch) {
    minutes += Math.round(Number(hourMatch[1]) * 60);
  }

  const minuteMatch = normalized.match(/(\d+)\s*(분|minutes?|mins?|m)/);
  if (minuteMatch) {
    minutes += Number(minuteMatch[1]);
  }

  if (minutes === 0) {
    const bareMinuteMatch = normalized.match(/(?:약|around|about)?\s*(\d+)\s*$/);
    if (bareMinuteMatch) {
      minutes = Number(bareMinuteMatch[1]);
    }
  }

  return Number.isFinite(minutes) ? minutes : 0;
}

function parseIngredientLine(line: string, index: number): Ingredient {
  const clean = line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
  const tokens = clean.split(/\s+/);
  let name = clean;
  let quantity = "";
  let unit = "";

  const quantityIndex = tokens.findIndex((token) =>
    /^(\d+([./]\d+)?|\d+\.\d+|약|조금|한|반)$/.test(token)
  );

  if (quantityIndex >= 0) {
    quantity = tokens[quantityIndex];
    const maybeUnit = tokens[quantityIndex + 1] ?? "";
    if (unitPattern.test(maybeUnit)) {
      unit = maybeUnit;
      name = tokens
        .filter((_, tokenIndex) => tokenIndex !== quantityIndex && tokenIndex !== quantityIndex + 1)
        .join(" ");
    } else {
      name = tokens.filter((_, tokenIndex) => tokenIndex !== quantityIndex).join(" ");
    }
  }

  if (!quantity) {
    const compactMatch = clean.match(/^(.+?)\s+(\d+(?:[./]\d+)?)([a-zA-Z가-힣]+)$/);
    if (compactMatch) {
      name = compactMatch[1];
      quantity = compactMatch[2];
      unit = compactMatch[3];
    }
  }

  const allergens = detectIngredientAllergens(name);

  return {
    id: createId("ingredient"),
    name: name.trim() || clean,
    quantity,
    unit,
    emoji: suggestEmoji(name || clean),
    allergens,
    order: index
  };
}

function parseEquipmentLine(line: string, index: number): Equipment {
  const clean = cleanListPrefix(line);
  const size = inferEquipmentSize(clean);
  const sizeLabelPattern =
    /(small|medium|large|소형|중형|대형|작은|작게|중간|보통|큰|크게)/i;
  const name = clean
    .replace(new RegExp(`\\s*[-:：]\\s*${sizeLabelPattern.source}\\s*$`, "i"), "")
    .replace(new RegExp(`^${sizeLabelPattern.source}\\s+`, "i"), "")
    .trim();

  return {
    id: createId("equipment"),
    name: name || clean,
    size,
    order: index
  };
}

function inferEquipmentSize(value: string): EquipmentSize {
  const normalized = value.normalize("NFKC").toLowerCase();
  if (/(large|대형|큰|크게)/.test(normalized)) {
    return "large";
  }

  if (/(small|소형|작은|작게)/.test(normalized)) {
    return "small";
  }

  return "medium";
}

function cleanupTitle(value: string): string {
  return value.replace(/^제목\s*[:：]\s*/i, "").trim();
}

function cleanStep(line: string): string {
  return cleanListPrefix(line);
}

function cleanListPrefix(line: string): string {
  return line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function getSectionName(line: string): SectionName | null {
  return sectionPatterns.find(([, pattern]) => pattern.test(line))?.[0] ?? null;
}

function getSectionCandidate(line: string): SectionName | null {
  return getSectionName(line) ?? getInlineSection(line)?.section ?? null;
}

function getInlineSection(line: string): { section: SectionName; value: string } | null {
  const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (!match) {
    return null;
  }

  const section = getSectionName(match[1].trim());
  if (!section) {
    return null;
  }

  return { section, value: match[2].trim() };
}

function looksLikeIngredient(line: string): boolean {
  return /^[-*•]/.test(line) || /\d/.test(line) || unitPattern.test(line);
}

function extractAllergenTokens(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens: string[] = [];
  const directMap: Array<[string, string[]]> = [
    ["egg", ["계란", "달걀", "egg"]],
    ["milk", ["우유", "유제품", "milk", "dairy"]],
    ["soy", ["대두", "콩", "soy"]],
    ["wheat", ["밀", "wheat", "gluten"]],
    ["shellfish", ["갑각류", "새우", "게", "shellfish", "shrimp", "crab"]],
    ["fish", ["생선", "fish"]],
    ["peanut", ["땅콩", "peanut"]],
    ["sesame", ["참깨", "깨", "sesame"]]
  ];

  for (const [id, aliases] of directMap) {
    if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
      tokens.push(id);
    }
  }

  return uniqueSorted(tokens);
}

function inferSpicyLevel(text: string): number {
  const normalized = text.toLowerCase();
  if (/(아주\s*매|불닭|extra\s*spicy|very\s*spicy)/.test(normalized)) {
    return 5;
  }

  if (/(맵|매운|spicy|고추장|고춧가루|청양)/.test(normalized)) {
    return 3;
  }

  if (/(mild|순한|약간\s*매)/.test(normalized)) {
    return 1;
  }

  return 1;
}

function inferDifficulty(text: string, stepCount: number): Difficulty {
  const normalized = text.toLowerCase();
  if (/(어려|고급|hard|advanced)/.test(normalized) || stepCount >= 9) {
    return "hard";
  }

  if (/(보통|medium|intermediate)/.test(normalized) || stepCount >= 5) {
    return "medium";
  }

  return "easy";
}

function calculateConfidence(draft: RecipeDraft, warnings: string[]): number {
  let score = 0.25;
  if (draft.title) score += 0.2;
  if (draft.ingredients.length > 0) score += 0.25;
  if (draft.steps.length > 0) score += 0.2;
  if (draft.timeMinutes > 0) score += 0.1;
  score -= warnings.length * 0.08;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
