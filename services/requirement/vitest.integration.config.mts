import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vitest.base.mts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Ersetzt die Platzhalter aus test/setup.ts durch die echten lokalen Werte
      setupFiles: ["./test/setup.integration.ts"],
      include: ["test/**/*.integration.spec.ts"],
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
