import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vitest.base.mts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
      exclude: ["**/node_modules/**", "**/*.integration.spec.ts"],
    },
  }),
);
