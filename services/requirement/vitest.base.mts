import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Gemeinsame Grundlage beider Testlaeufe. Die SWC-Einstellungen duerfen nicht
 * auseinanderlaufen - ohne sie fehlen die Decorator-Metadaten (siehe ADR-0008).
 */
export const baseConfig = defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
  },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
