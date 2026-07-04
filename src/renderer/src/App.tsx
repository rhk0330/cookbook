import {
  Beef,
  CalendarCheck,
  ChefHat,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  Flame,
  Grid3X3,
  Image,
  Languages,
  Pencil,
  Plus,
  Save,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactElement, ReactNode } from "react";
import { suggestEmoji } from "@shared/emoji";
import { aliasesForIngredientName, getHangulInitials, normalizeSearchText } from "@shared/search";
import type {
  AppSettings,
  Difficulty,
  Equipment,
  EquipmentSize,
  ImageAsset,
  Ingredient,
  LanguageCode,
  MainProtein,
  MealType,
  PixabayImageOption,
  Recipe,
  RecipeDraft,
  UnitSystem
} from "@shared/types";
import {
  createEmptyEquipment,
  createEmptyIngredient,
  createEmptyRecipeDraft,
  createEmptyStep,
  validateDraft
} from "@shared/validation";
import { emojiOptions, type EmojiOption } from "./emojiCatalog";
import { getAllergenLabel, type UiText, uiText } from "./i18n";

type StatusMessage =
  | { kind: "welcome"; index: number }
  | { kind: "recipeNotFound" }
  | { kind: "newRecipe" }
  | { kind: "saved" }
  | { kind: "deleted" }
  | { kind: "imageAdded" }
  | { kind: "pixabayNoResults" }
  | { kind: "pixabaySearchFailed" }
  | { kind: "pixabayImportFailed" }
  | { kind: "backupSaved" }
  | { kind: "backupCanceled" }
  | { kind: "backupImported" }
  | { kind: "pdfSaved" }
  | { kind: "pdfCanceled" }
  | { kind: "pdfFailed" }
  | { kind: "titleRequired" }
  | { kind: "ingredientRequired" }
  | { kind: "stepRequired" }
  | { kind: "validationFailed" };

type ImageSearchStatus = "idle" | "noResults" | "failed";

interface RecipeFilters {
  ingredients: string;
  maxSpice: number;
  maxTime: string;
  difficulty: "any" | Difficulty;
  allergen: string;
  equipment: string;
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

const mealTypeOptions: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "side",
  "soup",
  "snack",
  "dessert",
  "other"
];

const mainProteinOptions: MainProtein[] = [
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
];

export function App(): ReactElement {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<RecipeDraft>(createEmptyRecipeDraft);
  const [editing, setEditing] = useState(false);
  const [pixabayResults, setPixabayResults] = useState<PixabayImageOption[]>([]);
  const [pixabayQuery, setPixabayQuery] = useState("");
  const [pixabayPickerOpen, setPixabayPickerOpen] = useState(false);
  const [pixabayLoading, setPixabayLoading] = useState(false);
  const [imageSearchStatus, setImageSearchStatus] = useState<ImageSearchStatus>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState<RecipeFilters>({
    ingredients: "",
    maxSpice: 5,
    maxTime: "",
    difficulty: "any",
    allergen: "",
    equipment: ""
  });
  const [status, setStatus] = useState<StatusMessage>({
    kind: "welcome",
    index: randomWelcomeIndex("ko")
  });
  const gridRef = useRef<HTMLElement | null>(null);
  const recipeModalRef = useRef<HTMLElement | null>(null);

  const t = uiText[settings.language];
  const modalOpen = Boolean(selectedRecipe || editing);
  const modalTitle = editing
    ? draft.title.trim() || selectedRecipe?.title || t.untitledRecipe
    : selectedRecipe?.title ?? t.untitledRecipe;
  const scrollLocked = modalOpen || pixabayPickerOpen || settingsOpen;
  const filteredRecipes = useMemo(
    () => applyRecipeFilters(recipes, filters),
    [recipes, filters]
  );
  const allergenOptions = useMemo(
    () => [...new Set(recipes.flatMap((recipe) => recipe.allergens))].sort(),
    [recipes]
  );
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.accent = settings.accentColor;
  }, [settings.theme, settings.accentColor]);

  useEffect(() => {
    document.documentElement.classList.toggle("modal-scroll-locked", scrollLocked);
    document.body.classList.toggle("modal-scroll-locked", scrollLocked);

    return () => {
      document.documentElement.classList.remove("modal-scroll-locked");
      document.body.classList.remove("modal-scroll-locked");
    };
  }, [scrollLocked]);

  useEffect(() => {
    let canceled = false;

    async function runSearch(): Promise<void> {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      const results = await window.cookbook.recipes.search(query);
      if (!canceled) {
        setSearchResults(results);
      }
    }

    const timer = window.setTimeout(() => {
      void runSearch();
    }, 120);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function loadInitialData(): Promise<void> {
    const [nextSettings, nextRecipes] = await Promise.all([
      window.cookbook.settings.get(),
      window.cookbook.recipes.list()
    ]);
    setSettings(nextSettings);
    setRecipes(nextRecipes);
    setStatus({ kind: "welcome", index: randomWelcomeIndex(nextSettings.language) });
  }

  async function reloadRecipes(selectedId?: string): Promise<void> {
    const nextRecipes = await window.cookbook.recipes.list();
    setRecipes(nextRecipes);

    if (selectedId) {
      const nextSelected = nextRecipes.find((recipe) => recipe.id === selectedId) ?? null;
      setSelectedRecipe(nextSelected);
      if (nextSelected) {
        setDraft(recipeToDraft(nextSelected));
      }
    }
  }

  function scrollToGrid(): void {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function preserveRecipeModalScroll(action: () => void): void {
    const scrollTop = recipeModalRef.current?.scrollTop ?? 0;
    action();
    restoreRecipeModalScroll(scrollTop);
  }

  function restoreRecipeModalScroll(scrollTop: number): void {
    const restore = (): void => {
      if (recipeModalRef.current) {
        recipeModalRef.current.scrollTop = scrollTop;
      }
    };

    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    window.setTimeout(restore, 80);
  }

  async function selectRecipe(recipe: Recipe): Promise<void> {
    const freshRecipe = await window.cookbook.recipes.get(recipe.id);
    if (!freshRecipe) {
      setStatus({ kind: "recipeNotFound" });
      return;
    }

    setSelectedRecipe(freshRecipe);
    setDraft(recipeToDraft(freshRecipe));
    setEditing(false);
    setSearchResults([]);
    setImageSearchStatus("idle");
  }

  function startNewRecipe(): void {
    setSelectedRecipe(null);
    setDraft(createRecipeDraftWithDefaultUnit(settings.lastIngredientUnit));
    setEditing(true);
    setSearchResults([]);
    setImageSearchStatus("idle");
    setStatus({ kind: "newRecipe" });
  }

  function closeExplodedTile(): void {
    setSelectedRecipe(null);
    setDraft(createRecipeDraftWithDefaultUnit(settings.lastIngredientUnit));
    setEditing(false);
    setImageSearchStatus("idle");
  }

  async function handleSave(): Promise<void> {
    const validationStatus = getValidationStatus(draft);
    if (validationStatus) {
      setStatus(validationStatus);
      return;
    }

    const errors = validateDraft(draft);
    if (errors.length > 0) {
      setStatus({ kind: "validationFailed" });
      return;
    }

    const saved = selectedRecipe
      ? await window.cookbook.recipes.update(selectedRecipe.id, draft)
      : await window.cookbook.recipes.create(draft);

    setSelectedRecipe(saved);
    setDraft(recipeToDraft(saved));
    setEditing(false);
    setStatus({ kind: "saved" });
    await reloadRecipes(saved.id);
  }

  async function handleDelete(): Promise<void> {
    if (!selectedRecipe) {
      return;
    }

    const confirmed = window.confirm(t.confirmDelete(selectedRecipe.title));
    if (!confirmed) {
      return;
    }

    await window.cookbook.recipes.delete(selectedRecipe.id);
    closeExplodedTile();
    setStatus({ kind: "deleted" });
    await reloadRecipes();
  }

  async function handlePickImage(): Promise<void> {
    const image = await window.cookbook.media.pickImage();
    if (image) {
      setDraft((current) => ({ ...current, coverImage: image }));
      setStatus({ kind: "imageAdded" });
    }
  }

  function handleFindPixabayImages(): void {
    const nextQuery = buildPixabayQuery(draft);

    preserveRecipeModalScroll(() => {
      setPixabayQuery(nextQuery);
      setPixabayResults([]);
      setImageSearchStatus("idle");
      setPixabayPickerOpen(true);
    });
  }

  async function handleSearchPixabayImages(): Promise<void> {
    const nextQuery = pixabayQuery
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    setPixabayQuery(nextQuery);
    if (!nextQuery) {
      setPixabayResults([]);
      setImageSearchStatus("noResults");
      return;
    }

    setPixabayLoading(true);
    setImageSearchStatus("idle");
    try {
      const results = await window.cookbook.media.searchPixabay(
        nextQuery,
        settings.language
      );
      setPixabayResults(results);
      if (results.length === 0) {
        setImageSearchStatus("noResults");
        setStatus({ kind: "pixabayNoResults" });
      }
    } catch {
      setImageSearchStatus("failed");
      setStatus({ kind: "pixabaySearchFailed" });
    } finally {
      setPixabayLoading(false);
    }
  }

  async function handleSelectPixabayImage(image: PixabayImageOption): Promise<void> {
    setPixabayLoading(true);
    try {
      const imported = await window.cookbook.media.importPixabayImage(
        image,
        draft.title || t.untitledRecipe
      );
      preserveRecipeModalScroll(() => {
        setDraft((current) => ({ ...current, coverImage: imported }));
        setPixabayPickerOpen(false);
        setPixabayResults([]);
        setImageSearchStatus("idle");
      });
      setStatus({ kind: "imageAdded" });
    } catch {
      setStatus({ kind: "pixabayImportFailed" });
    } finally {
      setPixabayLoading(false);
    }
  }

  async function handleExportRecipePdf(): Promise<void> {
    if (!selectedRecipe) {
      return;
    }

    try {
      const filePath = await window.cookbook.recipes.exportPdf(
        selectedRecipe.id,
        settings.language
      );
      setStatus({ kind: filePath ? "pdfSaved" : "pdfCanceled" });
    } catch {
      setStatus({ kind: "pdfFailed" });
    }
  }

  async function handleTileColumnsChange(value: number): Promise<void> {
    const tileSize = Math.min(5, Math.max(1, Math.round(value)));
    await handleSettingsChange({ tileSize });
  }

  async function handleLanguageChange(language: LanguageCode): Promise<void> {
    if (language === settings.language) {
      return;
    }

    await handleSettingsChange({ language });
  }

  async function handleSettingsChange(patch: Partial<AppSettings>): Promise<void> {
    const next = { ...settings, ...patch };
    setSettings(next);
    const saved = await window.cookbook.settings.update(patch);
    setSettings(saved);
    if (patch.language && patch.language !== settings.language) {
      setStatus({ kind: "welcome", index: randomWelcomeIndex(patch.language) });
    }
  }

  async function handleExport(): Promise<void> {
    const filePath = await window.cookbook.backup.export();
    setStatus({ kind: filePath ? "backupSaved" : "backupCanceled" });
  }

  async function handleImport(): Promise<void> {
    const importedRecipes = await window.cookbook.backup.import();
    setRecipes(importedRecipes);
    closeExplodedTile();
    setStatus({ kind: "backupImported" });
  }

  return (
    <main className="app-shell">
      <section className="welcome-section" aria-labelledby="welcome-title">
        <h1 id="welcome-title" className="visually-hidden">
          {t.appTitle}
        </h1>

        <LanguageToggle
          language={settings.language}
          t={t}
          onChange={(language) => void handleLanguageChange(language)}
        />

        <div className="search-cluster">
          <div className="search-box">
            <Search aria-hidden="true" size={22} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  void selectRecipe(searchResults[0]);
                }
              }}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchAria}
            />
          </div>
          <IconButton label={t.newRecipe} onClick={startNewRecipe}>
            <Plus size={24} />
          </IconButton>
          <IconButton label={t.globalSettings} onClick={() => setSettingsOpen(true)}>
            <SettingsIcon size={23} />
          </IconButton>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results" role="listbox" aria-label={t.searchResults}>
            {searchResults.map((recipe) => (
              <button
                key={recipe.id}
                className="search-result"
                onClick={() => void selectRecipe(recipe)}
                type="button"
              >
                <span>{recipe.coverImage ? "🖼️" : "🍽️"}</span>
                <strong>{recipe.title}</strong>
                <small>{formatMinutes(recipe.timeMinutes, t)}</small>
              </button>
            ))}
          </div>
        )}

        <button className="scroll-button" onClick={scrollToGrid} type="button">
          {t.viewRecipes}
        </button>
        <p className="status-line" aria-live="polite">
          {formatStatus(status, t)}
        </p>
      </section>

      <section className="grid-section" ref={gridRef} aria-labelledby="recipes-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.cookbookEyebrow}</p>
            <h2 id="recipes-title">{t.recipesTitle}</h2>
          </div>
          <div className="grid-tools">
            <details className="settings-popover tile-size-popover">
              <summary className="toolbar-button">
                <Grid3X3 aria-hidden="true" size={18} />
                <span>{t.tileSize}</span>
                <span className="toolbar-value">{settings.tileSize}</span>
                <ChevronDown aria-hidden="true" size={17} />
              </summary>
              <div className="popover-panel tile-size-panel">
                <label className="slider-label" htmlFor="tile-size">
                  {t.tileSize}
                </label>
                <div className="numbered-range">
                  <input
                    id="tile-size"
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={settings.tileSize}
                    onChange={(event) =>
                      void handleTileColumnsChange(Number(event.currentTarget.value))
                    }
                  />
                  <output htmlFor="tile-size">{t.columns(settings.tileSize)}</output>
                </div>
              </div>
            </details>
            <IconButton label={t.importBackup} onClick={() => void handleImport()}>
              <Upload size={20} />
            </IconButton>
            <IconButton label={t.exportBackup} onClick={() => void handleExport()}>
              <Download size={20} />
            </IconButton>
            <details className="settings-popover filter-popover">
              <summary className="toolbar-button">
                <SlidersHorizontal aria-hidden="true" size={18} />
                <span>{t.filters}</span>
                {activeFilterCount > 0 && (
                  <span className="toolbar-value">{activeFilterCount}</span>
                )}
                <ChevronDown aria-hidden="true" size={17} />
              </summary>
              <div className="popover-panel filter-popover-panel">
                <RecipeFiltersPanel
                  filters={filters}
                  allergenOptions={allergenOptions}
                  language={settings.language}
                  t={t}
                  onChange={setFilters}
                />
              </div>
            </details>
          </div>
        </div>

        <div className="recipe-grid" data-columns={settings.tileSize}>
          {filteredRecipes.map((recipe) => (
            <RecipeTile
              key={recipe.id}
              recipe={recipe}
              language={settings.language}
              t={t}
              onSelect={() => void selectRecipe(recipe)}
            />
          ))}
        </div>
      </section>

      {modalOpen && (
        <section
          className="recipe-modal"
          ref={recipeModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-surface">
            <div className="modal-topbar">
              <div>
                <p className="eyebrow">{t.recipeEyebrow}</p>
                <h2 id="modal-title">{modalTitle}</h2>
              </div>
              <div className="toolbar">
                {selectedRecipe && !editing && (
                  <>
                    <IconButton
                      label={t.exportRecipePdf}
                      onClick={() => void handleExportRecipePdf()}
                    >
                      <FileDown size={20} />
                    </IconButton>
                    <IconButton label={t.edit} onClick={() => setEditing(true)}>
                      <Pencil size={21} />
                    </IconButton>
                  </>
                )}
                {editing && (
                  <IconButton label={t.save} onClick={() => void handleSave()}>
                    <Save size={21} />
                  </IconButton>
                )}
                {selectedRecipe && (
                  <IconButton label={t.delete} onClick={() => void handleDelete()}>
                    <Trash2 size={20} />
                  </IconButton>
                )}
                <IconButton label={t.close} onClick={closeExplodedTile}>
                  <X size={21} />
                </IconButton>
              </div>
            </div>

            {editing ? (
              <RecipeEditor
                draft={draft}
                selectedRecipe={selectedRecipe}
                pixabayLoading={pixabayLoading}
                imageSearchStatus={imageSearchStatus}
                unitSystem={settings.unitSystem}
                defaultIngredientUnit={settings.lastIngredientUnit}
                recentEmojis={settings.recentEmojis}
                t={t}
                onDraftChange={setDraft}
                onPickImage={() => void handlePickImage()}
                onFindPixabayImages={() => void handleFindPixabayImages()}
                onRememberIngredientUnit={(unit) =>
                  void handleSettingsChange({ lastIngredientUnit: unit })
                }
                onRememberEmoji={(recentEmojis) =>
                  void handleSettingsChange({ recentEmojis })
                }
                onPreserveScroll={preserveRecipeModalScroll}
              />
            ) : selectedRecipe ? (
              <RecipeDetail
                recipe={selectedRecipe}
                language={settings.language}
                t={t}
              />
            ) : null}
          </div>
        </section>
      )}

      {pixabayPickerOpen && (
        <section
          className="image-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pixabay-picker-title"
        >
          <div className="image-picker-surface">
            <div className="modal-topbar">
              <div>
                <p className="eyebrow">{t.pixabayProvider}</p>
                <h2 id="pixabay-picker-title">{t.pixabayResults}</h2>
                <p className="subtle-line">{pixabayQuery}</p>
              </div>
              <IconButton
                label={t.close}
                onClick={() =>
                  preserveRecipeModalScroll(() => setPixabayPickerOpen(false))
                }
              >
                <X size={21} />
              </IconButton>
            </div>
            <form
              className="pixabay-search-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearchPixabayImages();
              }}
            >
              <div className="pixabay-search-box">
                <Search aria-hidden="true" size={20} />
                <input
                  value={pixabayQuery}
                  onChange={(event) => setPixabayQuery(event.target.value)}
                  placeholder={t.pixabaySearchPlaceholder}
                  aria-label={t.pixabaySearchPlaceholder}
                  autoFocus
                />
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={pixabayLoading || !pixabayQuery.trim()}
              >
                <Search size={18} />
                {pixabayLoading ? t.searchingImages : t.pixabaySearchButton}
              </button>
            </form>
            {imageSearchStatus !== "idle" && (
              <p className="editor-alert pixabay-alert">
                {imageSearchStatus === "noResults"
                  ? t.status.pixabayNoResults
                  : t.status.pixabaySearchFailed}
              </p>
            )}
            {pixabayResults.length > 0 ? (
              <div className="pixabay-grid">
                {pixabayResults.map((image, index) => (
                  <button
                    className="pixabay-option"
                    key={image.id}
                    type="button"
                    aria-label={`${pixabayQuery || t.untitledRecipe} ${index + 1}`}
                    disabled={pixabayLoading}
                  onClick={() => void handleSelectPixabayImage(image)}
                >
                  <img src={image.previewUrl} alt={pixabayQuery || t.untitledRecipe} />
                </button>
              ))}
            </div>
            ) : (
              <p className="pixabay-empty">{t.pixabayEmptyPrompt}</p>
            )}
            <p className="pixabay-attribution">{t.pixabayAttribution}</p>
          </div>
        </section>
      )}

      {settingsOpen && (
        <GlobalSettingsModal
          settings={settings}
          t={t}
          onClose={() => setSettingsOpen(false)}
          onChange={(patch) => void handleSettingsChange(patch)}
        />
      )}
    </main>
  );
}

function GlobalSettingsModal({
  settings,
  t,
  onClose,
  onChange
}: {
  settings: AppSettings;
  t: UiText;
  onClose: () => void;
  onChange: (patch: Partial<AppSettings>) => void;
}): ReactElement {
  const unitOptions = unitOptionsForSystem(settings.unitSystem);

  return (
    <section
      className="image-picker-modal settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="image-picker-surface settings-surface">
        <div className="modal-topbar">
          <div>
            <p className="eyebrow">{t.appTitle}</p>
            <h2 id="settings-title">{t.globalSettings}</h2>
          </div>
          <IconButton label={t.close} onClick={onClose}>
            <X size={21} />
          </IconButton>
        </div>

        <div className="settings-grid">
          <section className="settings-card" aria-labelledby="settings-language-title">
            <h3 id="settings-language-title">{t.languageLabel}</h3>
            <div className="segmented-control">
              <button
                className={settings.language === "en" ? "active" : ""}
                type="button"
                aria-pressed={settings.language === "en"}
                onClick={() => onChange({ language: "en" })}
              >
                {t.languageEnglish}
              </button>
              <button
                className={settings.language === "ko" ? "active" : ""}
                type="button"
                aria-pressed={settings.language === "ko"}
                onClick={() => onChange({ language: "ko" })}
              >
                {t.languageKorean}
              </button>
            </div>
          </section>

          <section className="settings-card" aria-labelledby="settings-units-title">
            <h3 id="settings-units-title">{t.unitSystem}</h3>
            <div className="segmented-control">
              <button
                className={settings.unitSystem === "metric" ? "active" : ""}
                type="button"
                aria-pressed={settings.unitSystem === "metric"}
                onClick={() => onChange({ unitSystem: "metric" })}
              >
                {t.unitMetric}
              </button>
              <button
                className={settings.unitSystem === "imperial" ? "active" : ""}
                type="button"
                aria-pressed={settings.unitSystem === "imperial"}
                onClick={() => onChange({ unitSystem: "imperial" })}
              >
                {t.unitImperial}
              </button>
            </div>
          </section>

          <section className="settings-card" aria-labelledby="settings-theme-title">
            <h3 id="settings-theme-title">{t.theme}</h3>
            <div className="segmented-control">
              <button
                className={settings.theme === "light" ? "active" : ""}
                type="button"
                aria-pressed={settings.theme === "light"}
                onClick={() => onChange({ theme: "light" })}
              >
                {t.lightMode}
              </button>
              <button
                className={settings.theme === "dark" ? "active" : ""}
                type="button"
                aria-pressed={settings.theme === "dark"}
                onClick={() => onChange({ theme: "dark" })}
              >
                {t.darkMode}
              </button>
            </div>
          </section>

          <section className="settings-card" aria-labelledby="settings-accent-title">
            <h3 id="settings-accent-title">{t.accentColor}</h3>
            <div className="accent-picker">
              {(["blue", "green", "red", "yellow"] as const).map((accent) => (
                <button
                  className={settings.accentColor === accent ? "active" : ""}
                  data-accent={accent}
                  key={accent}
                  type="button"
                  aria-pressed={settings.accentColor === accent}
                  onClick={() => onChange({ accentColor: accent })}
                >
                  <span aria-hidden="true" />
                  {t.accentLabels[accent]}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card settings-card-wide" aria-labelledby="settings-unit-memory-title">
            <h3 id="settings-unit-memory-title">{t.defaultUnit}</h3>
            <select
              value={settings.lastIngredientUnit}
              onChange={(event) =>
                onChange({ lastIngredientUnit: event.currentTarget.value })
              }
            >
              <option value="">{t.none}</option>
              {settings.lastIngredientUnit &&
                !unitOptions.includes(settings.lastIngredientUnit) && (
                  <option value={settings.lastIngredientUnit}>
                    {settings.lastIngredientUnit}
                  </option>
                )}
              {unitOptions.map((unit) => (
                <option value={unit} key={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <p className="subtle-line">{t.rememberedUnit}</p>
          </section>
        </div>
      </div>
    </section>
  );
}

function LanguageToggle({
  language,
  t,
  onChange
}: {
  language: LanguageCode;
  t: UiText;
  onChange: (language: LanguageCode) => void;
}): ReactElement {
  return (
    <div className="language-toggle" aria-label={t.languageLabel}>
      <Languages aria-hidden="true" size={18} />
      <button
        className={language === "en" ? "active" : ""}
        type="button"
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        {t.languageEnglish}
      </button>
      <button
        className={language === "ko" ? "active" : ""}
        type="button"
        aria-pressed={language === "ko"}
        onClick={() => onChange("ko")}
      >
        {t.languageKorean}
      </button>
    </div>
  );
}

function RecipeFiltersPanel({
  filters,
  allergenOptions,
  language,
  t,
  onChange
}: {
  filters: RecipeFilters;
  allergenOptions: string[];
  language: LanguageCode;
  t: UiText;
  onChange: (filters: RecipeFilters) => void;
}): ReactElement {
  return (
    <aside className="filter-panel" aria-label={t.filters}>
      <div className="filter-title">
        <h3>{t.filters}</h3>
        <button
          className="soft-button compact"
          type="button"
          onClick={() =>
            onChange({
              ingredients: "",
              maxSpice: 5,
              maxTime: "",
              difficulty: "any",
              allergen: "",
              equipment: ""
            })
          }
        >
          {t.clearFilters}
        </button>
      </div>
      <label className="field-label">
        {t.filterIngredients}
        <input
          value={filters.ingredients}
          onChange={(event) =>
            onChange({ ...filters, ingredients: event.currentTarget.value })
          }
          placeholder={t.filterIngredientPlaceholder}
        />
      </label>
      <label className="field-label">
        {t.filterMaxSpice}
        <div className="numbered-range">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={filters.maxSpice}
            onChange={(event) =>
              onChange({ ...filters, maxSpice: Number(event.currentTarget.value) })
            }
          />
          <output>{filters.maxSpice}/5</output>
        </div>
      </label>
      <label className="field-label">
        {t.filterMaxTime}
        <input
          type="number"
          min="0"
          value={filters.maxTime}
          onChange={(event) =>
            onChange({ ...filters, maxTime: event.currentTarget.value })
          }
          placeholder="45"
        />
      </label>
      <label className="field-label">
        {t.filterDifficulty}
        <select
          value={filters.difficulty}
          onChange={(event) =>
            onChange({
              ...filters,
              difficulty: event.currentTarget.value as RecipeFilters["difficulty"]
            })
          }
        >
          <option value="any">{t.any}</option>
          <option value="easy">{t.difficultyLabels.easy}</option>
          <option value="medium">{t.difficultyLabels.medium}</option>
          <option value="hard">{t.difficultyLabels.hard}</option>
        </select>
      </label>
      <label className="field-label">
        {t.filterAllergen}
        <select
          value={filters.allergen}
          onChange={(event) =>
            onChange({ ...filters, allergen: event.currentTarget.value })
          }
        >
          <option value="">{t.any}</option>
          {allergenOptions.map((allergen) => (
            <option key={allergen} value={allergen}>
              {getAllergenLabel(allergen, language)}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        {t.filterEquipment}
        <input
          value={filters.equipment}
          onChange={(event) =>
            onChange({ ...filters, equipment: event.currentTarget.value })
          }
          placeholder="wok"
        />
      </label>
    </aside>
  );
}

function RecipeDetail({
  recipe,
  language,
  t
}: {
  recipe: Recipe;
  language: LanguageCode;
  t: UiText;
}): ReactElement {
  return (
    <article className="recipe-detail">
      <div className="detail-hero">
        <CoverImage image={recipe.coverImage} title={recipe.title} t={t} />
        <div className="metric-strip" aria-label={t.recipeSummary}>
          <Metric icon={<Clock3 size={19} />} label={t.time} value={formatMinutes(recipe.timeMinutes, t)} />
          <Metric icon={<Flame size={19} />} label={t.spicy} value={`${Math.max(1, recipe.spicyLevel)}/5`} />
          <Metric
            icon={<ChefHat size={19} />}
            label={t.difficulty}
            value={t.difficultyLabels[recipe.difficulty]}
          />
          <Metric
            icon={<Grid3X3 size={19} />}
            label={t.mealType}
            value={t.mealTypeLabels[recipe.mealType]}
          />
          <Metric
            icon={<Beef size={19} />}
            label={t.mainProtein}
            value={t.mainProteinLabels[recipe.mainProtein]}
          />
          <Metric
            icon={<CalendarCheck size={19} />}
            label={t.prepAhead}
            value={recipe.prepAhead ? t.prepAheadLabels.yes : t.prepAheadLabels.no}
          />
        </div>
      </div>

      <div className="detail-content">
        <section aria-labelledby="ingredients-title">
          <h3 id="ingredients-title">{t.ingredients}</h3>
          <ul className="ingredient-list">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>
                <span className="ingredient-emoji">{ingredient.emoji}</span>
                <span className="ingredient-name">{ingredient.name}</span>
                <span className="ingredient-amount">
                  {[ingredient.quantity, ingredient.unit].filter(Boolean).join(" ")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="allergens-title">
          <h3 id="allergens-title">{t.allergens}</h3>
          <ChipList
            values={
              recipe.allergens.length > 0
                ? recipe.allergens.map((allergen) => getAllergenLabel(allergen, language))
                : [t.none]
            }
          />
        </section>

        <section aria-labelledby="equipment-title">
          <h3 id="equipment-title">{t.equipment}</h3>
          <ChipList
            values={
              recipe.equipment.length > 0
                ? recipe.equipment.map(
                    (item) => `${item.name} - ${t.equipmentSizeLabels[item.size]}`
                  )
                : [t.none]
            }
          />
        </section>

        <section aria-labelledby="steps-title">
          <h3 id="steps-title">{t.recipe}</h3>
          <ol className="steps-list">
            {recipe.steps.map((step) => (
              <li key={step.id}>{step.text}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="notes-title">
          <h3 id="notes-title">{t.notes}</h3>
          <p className="notes-text">{recipe.notes || t.none}</p>
        </section>
      </div>
    </article>
  );
}

interface RecipeEditorProps {
  draft: RecipeDraft;
  selectedRecipe: Recipe | null;
  pixabayLoading: boolean;
  imageSearchStatus: ImageSearchStatus;
  unitSystem: UnitSystem;
  defaultIngredientUnit: string;
  recentEmojis: string[];
  t: UiText;
  onDraftChange: (draft: RecipeDraft) => void;
  onPickImage: () => void;
  onFindPixabayImages: () => void;
  onRememberIngredientUnit: (unit: string) => void;
  onRememberEmoji: (recentEmojis: string[]) => void;
  onPreserveScroll: (action: () => void) => void;
}

function RecipeEditor({
  draft,
  selectedRecipe,
  pixabayLoading,
  imageSearchStatus,
  unitSystem,
  defaultIngredientUnit,
  recentEmojis,
  t,
  onDraftChange,
  onPickImage,
  onFindPixabayImages,
  onRememberIngredientUnit,
  onRememberEmoji,
  onPreserveScroll
}: RecipeEditorProps): ReactElement {
  const ingredientUnitOptions = unitOptionsForSystem(unitSystem);
  const [emojiPickerIndex, setEmojiPickerIndex] = useState<number | null>(null);
  const [emojiSearch, setEmojiSearch] = useState("");
  const filteredEmojiOptions = useMemo(
    () => filterEmojiOptions(emojiSearch),
    [emojiSearch]
  );

  function updateIngredient(index: number, patch: Partial<Ingredient>): void {
    const nextIngredients = draft.ingredients.map((ingredient, itemIndex) => {
      if (itemIndex !== index) {
        return ingredient;
      }

      const next = { ...ingredient, ...patch };
      if (patch.name && (!ingredient.emoji || ingredient.emoji === "🍽️")) {
        next.emoji = suggestEmoji(patch.name);
      }
      return next;
    });
    onDraftChange({ ...draft, ingredients: nextIngredients });
  }

  function addIngredient(): void {
    onDraftChange({
      ...draft,
      ingredients: [
        ...draft.ingredients,
        {
          ...createEmptyIngredient(draft.ingredients.length),
          unit: defaultIngredientUnit
        }
      ]
    });
  }

  function addEquipment(): void {
    onDraftChange({
      ...draft,
      equipment: [
        ...draft.equipment,
        createEmptyEquipment(draft.equipment.length)
      ]
    });
  }

  function addStep(): void {
    onDraftChange({
      ...draft,
      steps: [...draft.steps, createEmptyStep(draft.steps.length)]
    });
  }

  function updateEquipment(index: number, patch: Partial<Equipment>): void {
    onDraftChange({
      ...draft,
      equipment: draft.equipment.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    });
  }

  function selectEmoji(emoji: string): void {
    if (emojiPickerIndex === null) {
      return;
    }

    onPreserveScroll(() => {
      updateIngredient(emojiPickerIndex, { emoji });
      onRememberEmoji(rememberEmoji(recentEmojis, emoji));
      setEmojiPickerIndex(null);
      setEmojiSearch("");
    });
  }

  return (
    <>
      <div className="editor-grid">
        <div className="editor-main">
        <div className="editor-cover-frame">
          <CoverImage image={draft.coverImage} title={draft.title || t.untitledRecipe} t={t} />
        </div>
        <div className="editor-actions">
          <button className="soft-button" type="button" onClick={onPickImage}>
            <Image size={18} />
            {t.chooseImage}
          </button>
          <button
            className="soft-button"
            type="button"
            disabled={pixabayLoading}
            onClick={onFindPixabayImages}
          >
            <Search size={18} />
            {pixabayLoading ? t.searchingImages : t.findImage}
          </button>
        </div>
        {imageSearchStatus !== "idle" && (
          <p className="editor-alert">
            {imageSearchStatus === "noResults"
              ? t.status.pixabayNoResults
              : t.status.pixabaySearchFailed}
          </p>
        )}

        <label className="field-label">
          {t.title}
          <input
            value={draft.title}
            onChange={(event) =>
              onDraftChange({ ...draft, title: event.currentTarget.value })
            }
            placeholder={t.titlePlaceholder}
          />
        </label>

        <div className="form-row">
          <label className="field-label">
            {t.cookTime}
            <input
              type="number"
              min="0"
              value={draft.timeMinutes}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  timeMinutes: Number(event.currentTarget.value)
                })
              }
            />
          </label>
          <label className="field-label">
            {t.spiceLevel}
            <div className="numbered-range">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={Math.max(1, draft.spicyLevel)}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    spicyLevel: Number(event.currentTarget.value)
                  })
                }
              />
              <output>{Math.max(1, draft.spicyLevel)}/5</output>
            </div>
          </label>
          <label className="field-label">
            {t.difficulty}
            <select
              value={draft.difficulty}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  difficulty: event.currentTarget.value as Difficulty
                })
              }
            >
              <option value="easy">{t.difficultyLabels.easy}</option>
              <option value="medium">{t.difficultyLabels.medium}</option>
              <option value="hard">{t.difficultyLabels.hard}</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field-label">
            {t.mealType}
            <select
              value={draft.mealType}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  mealType: event.currentTarget.value as MealType
                })
              }
            >
              {mealTypeOptions.map((mealType) => (
                <option key={mealType} value={mealType}>
                  {t.mealTypeLabels[mealType]}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t.mainProtein}
            <select
              value={draft.mainProtein}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  mainProtein: event.currentTarget.value as MainProtein
                })
              }
            >
              {mainProteinOptions.map((mainProtein) => (
                <option key={mainProtein} value={mainProtein}>
                  {t.mainProteinLabels[mainProtein]}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            {t.prepAhead}
            <select
              value={draft.prepAhead ? "yes" : "no"}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  prepAhead: event.currentTarget.value === "yes"
                })
              }
            >
              <option value="no">{t.prepAheadLabels.no}</option>
              <option value="yes">{t.prepAheadLabels.yes}</option>
            </select>
          </label>
        </div>

        <label className="field-label">
          {t.allergens}
          <input
            value={draft.allergens.join(", ")}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                allergens: splitCsv(event.currentTarget.value)
              })
            }
            placeholder={t.allergensPlaceholder}
          />
        </label>

        <section className="editor-section" aria-labelledby="equipment-editor-title">
          <div className="mini-heading">
            <h3 id="equipment-editor-title">{t.equipment}</h3>
          </div>
          <div className="equipment-editor-list">
            {draft.equipment.map((item, index) => (
              <div className="equipment-editor-row" key={item.id}>
                <input
                  value={item.name}
                  onChange={(event) =>
                    updateEquipment(index, { name: event.currentTarget.value })
                  }
                  placeholder={t.equipmentName}
                />
                <select
                  value={item.size}
                  aria-label={t.equipmentSize}
                  onChange={(event) =>
                    updateEquipment(index, {
                      size: event.currentTarget.value as EquipmentSize
                    })
                  }
                >
                  <option value="small">{t.equipmentSizeLabels.small}</option>
                  <option value="medium">{t.equipmentSizeLabels.medium}</option>
                  <option value="large">{t.equipmentSizeLabels.large}</option>
                </select>
                <IconButton
                  label={t.removeEquipment}
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      equipment: draft.equipment.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))}
            <div className="list-add-row">
              <button
                className="soft-button list-add-button"
                type="button"
                onClick={addEquipment}
              >
                <Plus size={17} />
                {t.add}
              </button>
            </div>
          </div>
        </section>

        <section className="editor-section" aria-labelledby="ingredient-editor-title">
          <div className="mini-heading">
            <h3 id="ingredient-editor-title">{t.ingredients}</h3>
          </div>
          <div className="ingredient-editor-list">
            {draft.ingredients.map((ingredient, index) => (
              <div className="ingredient-editor-row" key={ingredient.id}>
                <button
                  className="emoji-trigger"
                  type="button"
                  aria-label={t.ingredientEmoji}
                  title={t.ingredientEmoji}
                  onClick={() => {
                    onPreserveScroll(() => {
                      setEmojiPickerIndex(index);
                      setEmojiSearch("");
                    });
                  }}
                >
                  {ingredient.emoji || "🍽️"}
                </button>
                <input
                  value={ingredient.name}
                  onChange={(event) =>
                    updateIngredient(index, { name: event.currentTarget.value })
                  }
                  placeholder={t.ingredientName}
                />
                <input
                  value={ingredient.quantity}
                  onChange={(event) =>
                    updateIngredient(index, { quantity: event.currentTarget.value })
                  }
                  placeholder={t.quantity}
                />
                <select
                  value={ingredient.unit}
                  aria-label={t.unit}
                  onChange={(event) =>
                    {
                      const unit = event.currentTarget.value;
                      updateIngredient(index, { unit });
                      onRememberIngredientUnit(unit);
                    }
                  }
                >
                  <option value="">{t.none}</option>
                  {ingredient.unit && !ingredientUnitOptions.includes(ingredient.unit) && (
                    <option value={ingredient.unit}>{ingredient.unit}</option>
                  )}
                  {ingredientUnitOptions.map((unit) => (
                    <option value={unit} key={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
                <IconButton
                  label={t.removeIngredient}
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      ingredients: draft.ingredients.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))}
            <div className="list-add-row">
              <button
                className="soft-button list-add-button"
                type="button"
                onClick={addIngredient}
              >
                <Plus size={17} />
                {t.add}
              </button>
            </div>
          </div>
        </section>

        <section className="editor-section" aria-labelledby="step-editor-title">
          <div className="mini-heading">
            <h3 id="step-editor-title">{t.recipe}</h3>
          </div>
          <div className="step-editor-list">
            {draft.steps.map((step, index) => (
              <div className="step-editor-row" key={step.id}>
                <span>{index + 1}</span>
                <textarea
                  value={step.text}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      steps: draft.steps.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, text: event.currentTarget.value }
                          : item
                      )
                    })
                  }
                  placeholder={t.stepPlaceholder}
                />
                <IconButton
                  label={t.removeStep}
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      steps: draft.steps.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))}
            <div className="list-add-row">
              <button
                className="soft-button list-add-button"
                type="button"
                onClick={addStep}
              >
                <Plus size={17} />
                {t.add}
              </button>
            </div>
          </div>
        </section>

        <label className="field-label">
          {t.notes}
          <textarea
            value={draft.notes}
            onChange={(event) =>
              onDraftChange({ ...draft, notes: event.currentTarget.value })
            }
            placeholder={t.notesPlaceholder}
          />
        </label>
      </div>

      </div>

      {emojiPickerIndex !== null && (
        <EmojiPickerModal
          options={filteredEmojiOptions}
          query={emojiSearch}
          recentEmojis={recentEmojis}
          t={t}
          onClose={() => {
            onPreserveScroll(() => {
              setEmojiPickerIndex(null);
              setEmojiSearch("");
            });
          }}
          onQueryChange={setEmojiSearch}
          onSelect={selectEmoji}
        />
      )}
    </>
  );
}

function EmojiPickerModal({
  options,
  query,
  recentEmojis,
  t,
  onClose,
  onQueryChange,
  onSelect
}: {
  options: EmojiOption[];
  query: string;
  recentEmojis: string[];
  t: UiText;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (emoji: string) => void;
}): ReactElement {
  return createPortal(
    <section
      className="emoji-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emoji-picker-title"
    >
      <div className="emoji-picker-surface">
        <div className="modal-topbar compact-heading">
          <div>
            <p className="eyebrow">{t.ingredients}</p>
            <h2 id="emoji-picker-title">{t.emojiPickerTitle}</h2>
          </div>
          <IconButton label={t.close} onClick={onClose}>
            <X size={21} />
          </IconButton>
        </div>

        <div className="emoji-search-box">
          <Search aria-hidden="true" size={19} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder={t.emojiSearchPlaceholder}
          />
        </div>

        {recentEmojis.length > 0 && (
          <section className="recent-emoji-section" aria-labelledby="recent-emoji-title">
            <h3 id="recent-emoji-title">{t.recentEmojis}</h3>
            <div className="recent-emoji-grid">
              {recentEmojis.map((emoji) => (
                <button
                  className="emoji-option"
                  key={emoji}
                  type="button"
                  aria-label={`${t.recentEmojis} ${emoji}`}
                  onClick={() => onSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        )}

        {options.length > 0 ? (
          <div className="emoji-grid" role="listbox" aria-label={t.emojiPickerTitle}>
            {options.map((option) => (
              <button
                className="emoji-option"
                key={`${option.category}-${option.emoji}`}
                type="button"
                aria-label={`${option.emoji} ${option.category}`}
                onClick={() => onSelect(option.emoji)}
              >
                {option.emoji}
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-emoji-results">{t.noEmojiResults}</p>
        )}
      </div>
    </section>,
    document.body
  );
}

function RecipeTile({
  recipe,
  language,
  t,
  onSelect
}: {
  recipe: Recipe;
  language: LanguageCode;
  t: UiText;
  onSelect: () => void;
}): ReactElement {
  return (
    <article
      className="recipe-tile"
      role="button"
      tabIndex={0}
      aria-label={t.openRecipe(recipe.title)}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="tile-inner">
        <div className="tile-face tile-front">
          <CoverImage image={recipe.coverImage} title={recipe.title} t={t} />
          <div className="tile-caption">
            <strong>{recipe.title}</strong>
          </div>
        </div>
        <div className="tile-face tile-back">
          <h3>{recipe.title}</h3>
          <Metric icon={<Clock3 size={18} />} label={t.time} value={formatMinutes(recipe.timeMinutes, t)} />
          <Metric icon={<Flame size={18} />} label={t.spicy} value={`${Math.max(1, recipe.spicyLevel)}/5`} />
          <Metric
            icon={<ChefHat size={18} />}
            label={t.difficulty}
            value={t.difficultyLabels[recipe.difficulty]}
          />
          <ChipList
            values={
              recipe.allergens.length > 0
                ? recipe.allergens
                    .map((allergen) => getAllergenLabel(allergen, language))
                    .slice(0, 4)
                : [t.noAllergens]
            }
          />
        </div>
      </div>
    </article>
  );
}

function CoverImage({
  image,
  title,
  t
}: {
  image: ImageAsset | null;
  title: string;
  t: UiText;
}): ReactElement {
  if (!image) {
    return (
      <div className="cover-placeholder" aria-label={t.noCover(title)}>
        <span>🍽️</span>
      </div>
    );
  }

  return <img className="cover-image" src={image.url} alt={image.altText || title} />;
}

function Metric({
  icon,
  label,
  value
}: {
  icon: ReactElement;
  label: string;
  value: string;
}): ReactElement {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChipList({ values }: { values: string[] }): ReactElement {
  return (
    <div className="chip-list">
      {values.map((value) => (
        <span className="chip" key={value}>
          {value}
        </span>
      ))}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    title: recipe.title,
    aliases: recipe.aliases,
    timeMinutes: recipe.timeMinutes,
    spicyLevel: Math.max(1, recipe.spicyLevel),
    difficulty: recipe.difficulty,
    mealType: recipe.mealType,
    mainProtein: recipe.mainProtein,
    prepAhead: recipe.prepAhead,
    allergens: recipe.allergens,
    coverImage: recipe.coverImage,
    ingredients: recipe.ingredients,
    equipment: recipe.equipment,
    steps: recipe.steps,
    notes: recipe.notes
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getValidationStatus(draft: RecipeDraft): StatusMessage | null {
  if (!draft.title.trim()) {
    return { kind: "titleRequired" };
  }

  if (!draft.ingredients.some((ingredient) => ingredient.name.trim())) {
    return { kind: "ingredientRequired" };
  }

  if (!draft.steps.some((step) => step.text.trim())) {
    return { kind: "stepRequired" };
  }

  return null;
}

function formatStatus(status: StatusMessage, t: UiText): string {
  if (status.kind === "welcome") {
    return t.welcomeMessages[status.index % t.welcomeMessages.length];
  }

  return t.status[status.kind];
}

function formatMinutes(minutes: number, t: UiText): string {
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

function randomWelcomeIndex(language: LanguageCode): number {
  return Math.floor(Math.random() * uiText[language].welcomeMessages.length);
}

function applyRecipeFilters(recipes: Recipe[], filters: RecipeFilters): Recipe[] {
  const ingredientQuery = filters.ingredients.trim();
  const maxTime = Number(filters.maxTime);
  const hasMaxTime = filters.maxTime.trim() !== "" && Number.isFinite(maxTime);
  const equipmentQuery = filters.equipment.trim();

  return recipes.filter((recipe) => {
    if (ingredientQuery && !matchesIngredients(recipe, ingredientQuery)) {
      return false;
    }

    if (recipe.spicyLevel > filters.maxSpice) {
      return false;
    }

    if (hasMaxTime && recipe.timeMinutes > maxTime) {
      return false;
    }

    if (filters.difficulty !== "any" && recipe.difficulty !== filters.difficulty) {
      return false;
    }

    if (filters.allergen && !recipe.allergens.includes(filters.allergen)) {
      return false;
    }

    if (equipmentQuery && !matchesText(recipe.equipment.map((item) => item.name), equipmentQuery)) {
      return false;
    }

    return true;
  });
}

function matchesText(values: string[], query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = values.join(" ");
  const normalized = normalizeSearchText(haystack);
  const initials = normalizeSearchText(getHangulInitials(haystack));
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.every((token) => normalized.includes(token) || initials.includes(token));
}

function matchesIngredients(recipe: Recipe, query: string): boolean {
  const values = recipe.ingredients.flatMap((ingredient) => [
    ingredient.name,
    ingredient.quantity,
    ingredient.unit,
    ingredient.emoji,
    ...aliasesForIngredientName(ingredient.name)
  ]);
  return matchesText(values, query);
}

function countActiveFilters(filters: RecipeFilters): number {
  return [
    filters.ingredients.trim(),
    filters.maxSpice < 5 ? String(filters.maxSpice) : "",
    filters.maxTime.trim(),
    filters.difficulty !== "any" ? filters.difficulty : "",
    filters.allergen,
    filters.equipment.trim()
  ].filter(Boolean).length;
}

function buildPixabayQuery(draft: RecipeDraft): string {
  return draft.title
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function createRecipeDraftWithDefaultUnit(unit: string): RecipeDraft {
  const draft = createEmptyRecipeDraft();
  if (!unit) {
    return draft;
  }

  return {
    ...draft,
    ingredients: draft.ingredients.map((ingredient) => ({
      ...ingredient,
      unit
    }))
  };
}

function filterEmojiOptions(query: string): EmojiOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return emojiOptions;
  }

  return emojiOptions
    .filter((option) =>
      option.emoji.includes(normalizedQuery) ||
      option.keywords.includes(normalizedQuery)
    )
    .slice(0, 180);
}

function rememberEmoji(recentEmojis: string[], emoji: string): string[] {
  const cleanEmoji = emoji.trim();
  if (!cleanEmoji) {
    return recentEmojis;
  }

  return [cleanEmoji, ...recentEmojis.filter((item) => item !== cleanEmoji)]
    .slice(0, 24);
}

function unitOptionsForSystem(unitSystem: UnitSystem): string[] {
  const common = ["tsp", "tbsp", "cup", "piece", "clove", "slice", "sheet", "block", "stalk"];
  const metric = ["g", "kg", "ml", "L", "cm", "개", "쪽", "모", "장", "줄", "컵", "큰술", "작은술"];
  const imperial = ["oz", "lb", "fl oz", "pint", "quart"];
  return unitSystem === "imperial"
    ? [...common, ...imperial]
    : [...common, ...metric];
}
