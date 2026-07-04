import { BrowserWindow, dialog } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { allergenDictionary } from "@shared/dictionaries";
import { formatIngredientAmount } from "@shared/units";
import type { LanguageCode, Recipe } from "@shared/types";
import type { DataPaths } from "./paths";

const labels = {
  ko: {
    time: "시간",
    spicy: "맵기",
    difficulty: "난이도",
    mealType: "식사 종류",
    mainProtein: "주 단백질",
    prepAhead: "미리 준비",
    ingredients: "재료",
    equipment: "도구",
    allergens: "알레르기",
    instructions: "레시피",
    notes: "노트",
    noAllergens: "없음",
    minutesNone: "시간 없음",
    minutes: (minutes: number) => `${minutes}분`,
    hours: (hours: number) => `${hours}시간`,
    hoursMinutes: (hours: number, minutes: number) => `${hours}시간 ${minutes}분`,
    difficultyLabels: {
      easy: "쉬움",
      medium: "보통",
      hard: "어려움"
    },
    mealTypeLabels: {
      breakfast: "아침",
      lunch: "점심",
      dinner: "저녁",
      side: "반찬",
      soup: "국/찌개",
      snack: "간식",
      dessert: "디저트",
      other: "기타"
    },
    mainProteinLabels: {
      beef: "소고기",
      pork: "돼지고기",
      chicken: "닭고기",
      seafood: "해산물",
      fish: "생선",
      tofu: "두부",
      egg: "계란",
      vegetable: "채소",
      none: "없음",
      other: "기타"
    },
    prepAheadLabels: {
      yes: "가능",
      no: "아니요"
    }
  },
  en: {
    time: "Time",
    spicy: "Spice",
    difficulty: "Difficulty",
    mealType: "Meal type",
    mainProtein: "Main protein",
    prepAhead: "Prep ahead",
    ingredients: "Ingredients",
    equipment: "Equipment",
    allergens: "Allergens",
    instructions: "Recipe",
    notes: "Notes",
    noAllergens: "None",
    minutesNone: "No time",
    minutes: (minutes: number) => `${minutes} min`,
    hours: (hours: number) => `${hours} hr`,
    hoursMinutes: (hours: number, minutes: number) => `${hours} hr ${minutes} min`,
    difficultyLabels: {
      easy: "Easy",
      medium: "Medium",
      hard: "Hard"
    },
    mealTypeLabels: {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      side: "Side dish",
      soup: "Soup/stew",
      snack: "Snack",
      dessert: "Dessert",
      other: "Other"
    },
    mainProteinLabels: {
      beef: "Beef",
      pork: "Pork",
      chicken: "Chicken",
      seafood: "Seafood",
      fish: "Fish",
      tofu: "Tofu",
      egg: "Egg",
      vegetable: "Vegetable",
      none: "None",
      other: "Other"
    },
    prepAheadLabels: {
      yes: "Yes",
      no: "No"
    }
  }
};

export class PdfService {
  constructor(private readonly paths: DataPaths) {}

  async exportRecipe(recipe: Recipe, language: LanguageCode): Promise<string | null> {
    const safeTitle = sanitizeFilename(recipe.title || "recipe");
    const result = await dialog.showSaveDialog({
      title: language === "ko" ? "레시피 PDF 저장" : "Export recipe PDF",
      defaultPath: join(this.paths.backups, `${safeTitle}.pdf`),
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const pdf = await this.renderRecipePdf(recipe, language);
    writeFileSync(result.filePath, pdf);
    return result.filePath;
  }

  async renderRecipePdf(recipe: Recipe, language: LanguageCode): Promise<Buffer> {
    const pdfWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    try {
      const html = renderRecipeHtml(recipe, language, this.paths.root);
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      return await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: {
          marginType: "custom",
          top: 0.45,
          bottom: 0.45,
          left: 0.45,
          right: 0.45
        }
      });
    } finally {
      pdfWindow.close();
    }
  }
}

function renderRecipeHtml(recipe: Recipe, language: LanguageCode, dataRoot: string): string {
  const t = labels[language];
  const imageSource = recipe.coverImage
    ? imageToDataUri(resolve(dataRoot, recipe.coverImage.localPath))
    : null;
  const allergens =
    recipe.allergens.length > 0
      ? recipe.allergens.map((id) => getAllergenLabel(id, language))
      : [t.noAllergens];

  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #202124;
        background: #ffffff;
        font-family: "Noto Sans KR", "Pretendard", "Segoe UI", Arial, sans-serif;
      }
      .page { padding: 28px; }
      .hero {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        align-items: stretch;
        margin-bottom: 24px;
      }
      .cover, .cover-placeholder {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border: 1px solid #e8eaed;
        border-radius: 28px;
        background: #f8fafc;
      }
      .cover-placeholder {
        display: grid;
        place-items: center;
        color: #5f6368;
        font-size: 64px;
      }
      .title-box {
        display: grid;
        align-content: center;
        gap: 18px;
        padding: 24px;
        border: 1px solid #e8eaed;
        border-radius: 28px;
      }
      h1 { margin: 0; font-size: 42px; line-height: 1.08; }
      h2 { margin: 0 0 12px; font-size: 20px; }
      .metrics {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .metric, .section, .ingredient {
        border: 1px solid #e8eaed;
        border-radius: 18px;
        background: #ffffff;
      }
      .metric { padding: 14px; }
      .metric span { display: block; color: #5f6368; font-size: 12px; margin-bottom: 6px; }
      .metric strong { font-size: 16px; }
      .section { padding: 18px; margin-top: 16px; page-break-inside: avoid; }
      .ingredients {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .ingredient {
        display: grid;
        grid-template-columns: 32px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 10px 12px;
      }
      .amount, .chip { color: #5f6368; }
      .chips { display: flex; gap: 8px; flex-wrap: wrap; }
      .chip {
        padding: 7px 11px;
        border: 1px solid #e8eaed;
        border-radius: 999px;
      }
      ol { margin: 0; padding-left: 24px; }
      li { margin: 0 0 10px; line-height: 1.55; }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        ${
          imageSource
            ? `<img class="cover" src="${imageSource}" alt="${escapeHtml(recipe.title)}" />`
            : `<div class="cover-placeholder">🍽️</div>`
        }
        <div class="title-box">
          <h1>${escapeHtml(recipe.title)}</h1>
          <div class="metrics">
            <div class="metric"><span>${t.time}</span><strong>${formatMinutes(recipe.timeMinutes, language)}</strong></div>
            <div class="metric"><span>${t.spicy}</span><strong>${Math.max(1, recipe.spicyLevel)}/5</strong></div>
            <div class="metric"><span>${t.difficulty}</span><strong>${t.difficultyLabels[recipe.difficulty]}</strong></div>
            <div class="metric"><span>${t.mealType}</span><strong>${t.mealTypeLabels[recipe.mealType]}</strong></div>
            <div class="metric"><span>${t.mainProtein}</span><strong>${t.mainProteinLabels[recipe.mainProtein]}</strong></div>
            <div class="metric"><span>${t.prepAhead}</span><strong>${recipe.prepAhead ? t.prepAheadLabels.yes : t.prepAheadLabels.no}</strong></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>${t.ingredients}</h2>
        <div class="ingredients">
          ${recipe.ingredients
            .map(
              (ingredient) => `<div class="ingredient">
                <span>${escapeHtml(ingredient.emoji)}</span>
                <strong>${escapeHtml(ingredient.name)}</strong>
                <span class="amount">${escapeHtml(formatIngredientAmount(ingredient.quantity, ingredient.unit, language))}</span>
              </div>`
            )
            .join("")}
        </div>
      </section>
      ${
        recipe.equipment.length > 0
          ? `<section class="section">
              <h2>${t.equipment}</h2>
              <div class="chips">
                ${recipe.equipment
                  .map(
                    (item) =>
                      `<span class="chip">${escapeHtml(item.name)} - ${escapeHtml(item.size)}</span>`
                  )
                  .join("")}
              </div>
            </section>`
          : ""
      }
      <section class="section">
        <h2>${t.allergens}</h2>
        <div class="chips">
          ${allergens.map((allergen) => `<span class="chip">${escapeHtml(allergen)}</span>`).join("")}
        </div>
      </section>
      <section class="section">
        <h2>${t.instructions}</h2>
        <ol>
          ${recipe.steps.map((step) => `<li>${escapeHtml(step.text)}</li>`).join("")}
        </ol>
      </section>
      ${
        recipe.notes.trim()
          ? `<section class="section"><h2>${t.notes}</h2><p>${escapeHtml(recipe.notes)}</p></section>`
          : ""
      }
    </main>
  </body>
</html>`;
}

function formatMinutes(minutes: number, language: LanguageCode): string {
  const t = labels[language];
  if (minutes <= 0) {
    return t.minutesNone;
  }

  if (minutes < 60) {
    return t.minutes(minutes);
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? t.hoursMinutes(hours, remainder) : t.hours(hours);
}

function getAllergenLabel(id: string, language: LanguageCode): string {
  const allergen = allergenDictionary.find((entry) => entry.id === id);
  if (!allergen) {
    return id;
  }

  return language === "ko" ? allergen.labelKo : allergen.labelEn;
}

function imageToDataUri(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }

  const mime = mimeForPath(path);
  const data = readFileSync(path).toString("base64");
  return `data:${mime};base64,${data}`;
}

function mimeForPath(path: string): string {
  const extension = extname(path).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  return "image/png";
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim() || "recipe";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
