/// <reference types="vite/client" />

import type { CookbookApi } from "@shared/types";

declare global {
  interface Window {
    cookbook: CookbookApi;
  }
}
