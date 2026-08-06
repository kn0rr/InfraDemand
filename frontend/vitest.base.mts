import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  resolve: {
    // Bildet den paths-Alias aus tsconfig.json nach. Bewusst von Hand statt ueber
    // vite-tsconfig-paths - eine Zeile gegen eine weitere Abhaengigkeit.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    testTimeout: 30_000,
  },
});
