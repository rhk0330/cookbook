import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  CookbookApi,
  LanguageCode,
  PixabayImageOption,
  RecipeDraft
} from "@shared/types";

const cookbookApi: CookbookApi = {
  recipes: {
    list: () => ipcRenderer.invoke("recipes:list"),
    search: (query: string) => ipcRenderer.invoke("recipes:search", query),
    get: (id: string) => ipcRenderer.invoke("recipes:get", id),
    create: (draft: RecipeDraft) => ipcRenderer.invoke("recipes:create", draft),
    update: (id: string, draft: RecipeDraft) =>
      ipcRenderer.invoke("recipes:update", id, draft),
    delete: (id: string) => ipcRenderer.invoke("recipes:delete", id),
    exportPdf: (id: string, language: LanguageCode) =>
      ipcRenderer.invoke("recipes:exportPdf", id, language),
    printPdf: (id: string, language: LanguageCode) =>
      ipcRenderer.invoke("recipes:printPdf", id, language)
  },
  media: {
    importImage: (filePath: string) => ipcRenderer.invoke("media:importImage", filePath),
    pickImage: () => ipcRenderer.invoke("media:pickImage"),
    pickImages: () => ipcRenderer.invoke("media:pickImages"),
    generateCover: (recipeId: string) =>
      ipcRenderer.invoke("media:generateCover", recipeId),
    searchPixabay: (query: string, language: LanguageCode) =>
      ipcRenderer.invoke("media:searchPixabay", query, language),
    importPixabayImage: (image: PixabayImageOption, title: string) =>
      ipcRenderer.invoke("media:importPixabayImage", image, title)
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch: Partial<AppSettings>) =>
      ipcRenderer.invoke("settings:update", patch)
  },
  sharing: {
    getInfo: () => ipcRenderer.invoke("sharing:getInfo"),
    setEditTarget: (id: string | null) => ipcRenderer.invoke("sharing:setEditTarget", id)
  },
  sync: {
    getRevision: () => ipcRenderer.invoke("sync:getRevision")
  },
  backup: {
    export: () => ipcRenderer.invoke("backup:export"),
    import: () => ipcRenderer.invoke("backup:import")
  }
};

contextBridge.exposeInMainWorld("cookbook", cookbookApi);
