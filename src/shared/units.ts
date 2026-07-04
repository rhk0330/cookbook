import type { LanguageCode, UnitSystem } from "./types";

interface UnitOption {
  value: string;
  labelEn: string;
  labelKo: string;
  aliases: string[];
}

const commonUnits: UnitOption[] = [
  { value: "tsp", labelEn: "tsp", labelKo: "작은술", aliases: ["작은술", "티스푼"] },
  { value: "tbsp", labelEn: "tbsp", labelKo: "큰술", aliases: ["큰술", "스푼"] },
  { value: "cup", labelEn: "cup", labelKo: "컵", aliases: ["컵"] },
  { value: "piece", labelEn: "piece", labelKo: "개", aliases: ["개"] },
  { value: "clove", labelEn: "clove", labelKo: "쪽", aliases: ["쪽"] },
  { value: "slice", labelEn: "slice", labelKo: "조각", aliases: ["조각"] },
  { value: "sheet", labelEn: "sheet", labelKo: "장", aliases: ["장"] },
  { value: "block", labelEn: "block", labelKo: "모", aliases: ["모"] },
  { value: "stalk", labelEn: "stalk", labelKo: "줄", aliases: ["줄"] }
];

const metricUnits: UnitOption[] = [
  { value: "g", labelEn: "g", labelKo: "g", aliases: ["그램"] },
  { value: "kg", labelEn: "kg", labelKo: "kg", aliases: ["킬로그램"] },
  { value: "ml", labelEn: "ml", labelKo: "ml", aliases: ["밀리리터"] },
  { value: "L", labelEn: "L", labelKo: "L", aliases: ["l", "리터"] },
  { value: "cm", labelEn: "cm", labelKo: "cm", aliases: ["센티미터"] }
];

const imperialUnits: UnitOption[] = [
  { value: "oz", labelEn: "oz", labelKo: "온스", aliases: ["온스"] },
  { value: "lb", labelEn: "lb", labelKo: "파운드", aliases: ["파운드"] },
  { value: "fl oz", labelEn: "fl oz", labelKo: "액량 온스", aliases: ["액량온스"] },
  { value: "pint", labelEn: "pint", labelKo: "파인트", aliases: ["파인트"] },
  { value: "quart", labelEn: "quart", labelKo: "쿼트", aliases: ["쿼트"] }
];

export function unitOptionsForSystem(unitSystem: UnitSystem): string[] {
  const units = unitSystem === "imperial"
    ? [...commonUnits, ...imperialUnits]
    : [...commonUnits, ...metricUnits];

  return units.map((unit) => unit.value);
}

export function canonicalUnitValue(value: string): string {
  const clean = value.trim();
  const normalized = clean.normalize("NFKC").toLowerCase();
  const option = [...commonUnits, ...metricUnits, ...imperialUnits].find((unit) => {
    const values = [unit.value, unit.labelEn, unit.labelKo, ...unit.aliases];
    return values.some((item) => item.normalize("NFKC").toLowerCase() === normalized);
  });

  return option?.value ?? clean;
}

export function unitLabel(value: string, language: LanguageCode): string {
  const canonical = canonicalUnitValue(value);
  const option = [...commonUnits, ...metricUnits, ...imperialUnits].find(
    (unit) => unit.value === canonical
  );

  if (!option) {
    return value.trim();
  }

  return language === "ko" ? option.labelKo : option.labelEn;
}

export function formatIngredientAmount(
  quantity: string,
  unit: string,
  language: LanguageCode
): string {
  const cleanQuantity = quantity.trim();
  const cleanUnit = unit.trim();
  if (!cleanQuantity && !cleanUnit) {
    return "";
  }

  if (!cleanUnit) {
    return cleanQuantity;
  }

  const label = unitLabel(cleanUnit, language);
  return [cleanQuantity, label].filter(Boolean).join(" ");
}
