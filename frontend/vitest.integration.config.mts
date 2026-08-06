import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vitest.base.mts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Ersetzt die Platzhalter durch die echten lokalen Werte
    test: {
      setupFiles: ["./test/setup.integration.ts"],
      include: ["test/**/*.integration.spec.ts"],
    },
  }),
);
