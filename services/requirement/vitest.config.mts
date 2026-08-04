import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
