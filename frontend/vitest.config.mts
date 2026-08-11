import { defineConfig, mergeConfig } from "vitest/config";
import { baseConfig } from "./vitest.base.mts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Next.js verlangt `jsx: "preserve"` in der tsconfig - Vite uebernimmt das und laesst
    // JSX unverwandelt, was der Testlauf nicht parsen kann. Hier wird es nur fuer Tests
    // ueberschrieben.
    //
    // Bewusst diese eine Option statt `@vitejs/plugin-react`: Von dem Plugin braeuchten
    // wir nichts ausser der Verwandlung - dieselbe Ueberlegung wie beim paths-Alias in
    // `vitest.base.mts`, eine Zeile gegen eine weitere Abhaengigkeit.
    oxc: { jsx: { runtime: "automatic" } },
    test: {
      // Komponententests brauchen ein DOM; die reinen Modultests stoert es nicht.
      environment: "jsdom",
      setupFiles: ["./test/setup.komponenten.ts"],
      include: ["test/**/*.spec.{ts,tsx}"],
      exclude: ["**/node_modules/**", "**/*.integration.spec.ts"],
    },
  }),
);
