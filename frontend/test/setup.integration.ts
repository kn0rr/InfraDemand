import { join } from "node:path";

/**
 * Laedt die lokalen Werte aus der einzigen Quelle. Hartkodierte Adressen im Test
 * waeren eine weitere Kopie, die beim naechsten Wechsel vergessen wird.
 *
 * `process.loadEnvFile` ist in Node eingebaut und ueberschreibt keine bereits
 * gesetzten Variablen - in der CI gewinnt damit die Job-Umgebung.
 */
try {
  process.loadEnvFile(join(import.meta.dirname, "..", "..", "infra", "local", "local.env"));
} catch {
  // Ohne die Datei muessen die Werte aus der Umgebung kommen.
}
