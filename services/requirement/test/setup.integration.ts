import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Laedt die Werte der lokalen Umgebung aus der einzigen Quelle. Integrationstests laufen
 * gegen echte Infrastruktur - hartkodierte Adressen im Test waeren eine weitere Kopie,
 * die beim naechsten Wechsel vergessen wird.
 */
const datei = resolve(process.cwd(), "../../infra/local/local.env");

for (const zeile of readFileSync(datei, "utf8").split("\n")) {
  const inhalt = zeile.trim();
  if (inhalt === "" || inhalt.startsWith("#")) {
    continue;
  }
  const trenner = inhalt.indexOf("=");
  if (trenner > 0) {
    process.env[inhalt.slice(0, trenner)] = inhalt.slice(trenner + 1);
  }
}
