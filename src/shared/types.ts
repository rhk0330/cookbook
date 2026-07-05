export type Difficulty = "easy" | "medium" | "hard";
export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "side"
  | "soup"
  | "snack"
  | "dessert"
  | "other";
export type MainProtein =
  | "beef"
  | "pork"
  | "chicken"
  | "seafood"
  | "fish"
  | "tofu"
  | "egg"
  | "vegetable"
  | "none"
  | "other";
export type EquipmentSize = "small" | "medium" | "large";
export type ImageRole = "cover" | "step";
export type ImageSource = "imported" | "generated" | "pixabay";
export type LanguageCode = "ko" | "en";
export type UnitSystem = "metric" | "imperial";
export type ThemeMode = "light" | "dark";
export type AccentColor = "blue" | "green" | "red" | "yellow";

export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  emoji: string;
  allergens: string[];
  order: number;
}

export interface InstructionStep {
  id: string;
  order: number;
  text: string;
  images: ImageAsset[];
}

export interface Equipment {
  id: string;
  name: string;
  size: EquipmentSize;
  order: number;
}

export interface ImageAsset {
  id: string;
  localPath: string;
  url: string;
  role: ImageRole;
  altText: string;
  source: ImageSource;
  sourceUrl?: string;
  attribution?: string;
  createdAt: string;
}

export interface PixabayImageOption {
  id: number;
  previewUrl: string;
  imageUrl: string;
  pageUrl: string;
  tags: string;
  user: string;
  width: number;
  height: number;
}

export interface Recipe {
  id: string;
  title: string;
  aliases: string[];
  timeMinutes: number;
  spicyLevel: number;
  difficulty: Difficulty;
  mealType: MealType;
  mainProtein: MainProtein;
  prepAhead: boolean;
  allergens: string[];
  coverImage: ImageAsset | null;
  coverImages: ImageAsset[];
  ingredients: Ingredient[];
  equipment: Equipment[];
  steps: InstructionStep[];
  notes: string;
  searchText: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeDraft {
  title: string;
  aliases: string[];
  timeMinutes: number;
  spicyLevel: number;
  difficulty: Difficulty;
  mealType: MealType;
  mainProtein: MainProtein;
  prepAhead: boolean;
  allergens: string[];
  coverImage: ImageAsset | null;
  coverImages: ImageAsset[];
  ingredients: Ingredient[];
  equipment: Equipment[];
  steps: InstructionStep[];
  notes: string;
}

export interface ParsedRecipe {
  draft: RecipeDraft;
  confidence: number;
  warnings: string[];
  sourceText: string;
}

export interface AppSettings {
  tileSize: number;
  language: LanguageCode;
  pixabayApiKey: string;
  unitSystem: UnitSystem;
  theme: ThemeMode;
  accentColor: AccentColor;
  lastIngredientUnit: string;
  customUnits: string[];
  hiddenUnits: string[];
  recentEmojis: string[];
  wifiSharingEnabled: boolean;
  wifiSharingPort: number;
}

export interface WifiSharingInfo {
  enabled: boolean;
  running: boolean;
  port: number;
  ipAddress: string;
  primaryUrl: string;
  friendlyUrl: string;
  allUrls: string[];
}

export interface CookbookApi {
  recipes: {
    list: () => Promise<Recipe[]>;
    search: (query: string) => Promise<Recipe[]>;
    get: (id: string) => Promise<Recipe | null>;
    create: (draft: RecipeDraft) => Promise<Recipe>;
    update: (id: string, draft: RecipeDraft) => Promise<Recipe>;
    delete: (id: string) => Promise<void>;
    exportPdf: (id: string, language: LanguageCode) => Promise<string | null>;
    printPdf: (id: string, language: LanguageCode) => Promise<boolean>;
  };
  media: {
    importImage: (filePath: string) => Promise<ImageAsset>;
    pickImage: () => Promise<ImageAsset | null>;
    pickImages: () => Promise<ImageAsset[]>;
    generateCover: (recipeId: string) => Promise<ImageAsset>;
    searchPixabay: (
      query: string,
      language: LanguageCode
    ) => Promise<PixabayImageOption[]>;
    importPixabayImage: (
      image: PixabayImageOption,
      title: string
    ) => Promise<ImageAsset>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  };
  sharing: {
    getInfo: () => Promise<WifiSharingInfo>;
    setEditTarget: (id: string | null) => Promise<void>;
  };
  sync: {
    getRevision: () => Promise<number>;
  };
  backup: {
    export: () => Promise<string | null>;
    import: () => Promise<Recipe[]>;
  };
}
