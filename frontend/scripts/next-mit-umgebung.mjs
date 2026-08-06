/**
 * Startet Next mit den Werten aus infra/local/local.env.
 *
 * Warum nicht `node --env-file=... next`: `next dev` liest die Node-Optionen des
 * Elternprozesses und reicht alles, was nicht in einer vier Eintraege langen
 * Positivliste steht, ueber NODE_OPTIONS an seinen Kindprozess weiter. Env-Dateien
 * sind in NODE_OPTIONS verboten, weil sie geladen sein muessen, bevor NODE_OPTIONS
 * ausgewertet wird. Dieses Skript hat selbst keine Node-Flags - es gibt also nichts
 * weiterzureichen - und setzt die Werte stattdessen in die Prozessumgebung, die der
 * Kindprozess ohnehin erbt.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const umgebungsdatei = join(import.meta.dirname, "..", "..", "infra", "local", "local.env");

try {
  // Ueberschreibt keine bereits gesetzten Variablen: In CI, Container und
  // produktiver Umgebung gewinnt die echte Umgebung gegen diese Datei.
  process.loadEnvFile(umgebungsdatei);
} catch {
  // Ausserhalb der lokalen Entwicklung gibt es die Datei nicht. Das ist der
  // Normalfall, kein Fehler - die Werte kommen dort aus der Umgebung selbst.
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: "inherit",
}).on("exit", (code) => {
  process.exit(code ?? 0);
});
