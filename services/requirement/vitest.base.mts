import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Container-Starts brauchen Luft, insbesondere beim ersten Lauf ohne Abbild im Cache
    hookTimeout: 90_000,
    testTimeout: 30_000,
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
