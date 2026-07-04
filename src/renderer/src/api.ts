import type {
  AppSettings,
  CookbookApi,
  ImageAsset,
  LanguageCode,
  PixabayImageOption,
  Recipe,
  RecipeDraft,
  WifiSharingInfo
} from "@shared/types";

export const isSharedBrowserClient = !window.cookbook;

export const cookbookApi: CookbookApi =
  window.cookbook ?? createHttpCookbookApi();

function createHttpCookbookApi(): CookbookApi {
  return {
    recipes: {
      list: () => requestJson<Recipe[]>("/api/recipes"),
      search: (query: string) =>
        requestJson<Recipe[]>(`/api/recipes/search?q=${encodeURIComponent(query)}`),
      get: (id: string) => requestJson<Recipe | null>(`/api/recipes/${encodeURIComponent(id)}`),
      create: (draft: RecipeDraft) =>
        requestJson<Recipe>("/api/recipes", {
          method: "POST",
          body: JSON.stringify(draft)
        }),
      update: (id: string, draft: RecipeDraft) =>
        requestJson<Recipe>(`/api/recipes/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(draft)
        }),
      delete: async (id: string) => {
        await requestRaw(`/api/recipes/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
      },
      exportPdf: async (id: string, language: LanguageCode) => {
        const response = await requestRaw(
          `/api/recipes/${encodeURIComponent(id)}/pdf?language=${language}`
        );
        const blob = await response.blob();
        downloadBlob(blob, `recipe-${id}.pdf`);
        return "downloaded";
      }
    },
    media: {
      importImage: async () => {
        throw new Error("Use pickImage in browser mode.");
      },
      pickImage: async () => {
        const file = await pickFile("image/*");
        if (!file) {
          return null;
        }

        const contentBase64 = await fileToBase64(file);
        return requestJson<ImageAsset>("/api/media/import-upload", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentBase64
          })
        });
      },
      generateCover: (recipeId: string) =>
        requestJson<ImageAsset>("/api/media/generate-cover", {
          method: "POST",
          body: JSON.stringify({ recipeId })
        }),
      searchPixabay: (query: string, language: LanguageCode) =>
        requestJson<PixabayImageOption[]>("/api/media/search-pixabay", {
          method: "POST",
          body: JSON.stringify({ query, language })
        }),
      importPixabayImage: (image: PixabayImageOption, title: string) =>
        requestJson<ImageAsset>("/api/media/import-pixabay", {
          method: "POST",
          body: JSON.stringify({ image, title })
        })
    },
    settings: {
      get: () => requestJson<AppSettings>("/api/settings"),
      update: (patch: Partial<AppSettings>) =>
        requestJson<AppSettings>("/api/settings", {
          method: "PATCH",
          body: JSON.stringify(patch)
        })
    },
    sharing: {
      getInfo: () => requestJson<WifiSharingInfo>("/api/sharing")
    },
    backup: {
      export: async () => {
        const response = await requestRaw("/api/backup/export");
        const blob = await response.blob();
        downloadBlob(blob, `cookbook-backup-${new Date().toISOString().slice(0, 10)}.json`);
        return "downloaded";
      },
      import: async () => {
        const file = await pickFile("application/json,.json");
        if (!file) {
          return requestJson<Recipe[]>("/api/recipes");
        }

        return requestJson<Recipe[]>("/api/backup/import", {
          method: "POST",
          body: await file.text()
        });
      }
    }
  };
}

async function requestJson<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await requestRaw(input, init);
  return (await response.json()) as T;
}

async function requestRaw(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response;
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolvePromise) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.addEventListener(
      "change",
      () => {
        resolvePromise(input.files?.[0] ?? null);
      },
      { once: true }
    );
    input.click();
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const value = String(reader.result ?? "");
      resolvePromise(value.includes(",") ? value.split(",")[1] : value);
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
