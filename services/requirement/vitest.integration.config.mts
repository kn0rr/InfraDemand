import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vitest.base.mts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["test/**/*.integration.spec.ts"],
      // Keycloak-Aufrufe ueber das Netzwerk brauchen mehr Luft als In-Process-Tests
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
