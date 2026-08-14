import { inArray, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { requirements } from "../database/schema";
import type { Sichtbarkeit, UcastFeld } from "./sichtbarkeit.typen";

/**
 * Zulaessige Felder, ausgeschrieben.
 *
 * Kein dynamisches Nachschlagen ueber den Spaltennamen: Ein unbekanntes Feld ist ein
 * Fehler und keine Bedingung, die man weglassen koennte. Weglassen hiesse „kein Filter",
 * und damit waere aus einer nicht verstandenen Richtlinie eine Freigabe geworden.
 */
const FELDER: Readonly<Record<string, PgColumn>> = {
  "requirement.tenant": requirements.tenant,
};

/**
 * Uebersetzt die Auskunft in eine Bedingung fuer die Abfrage.
 *
 * **Jeder nicht behandelte Fall wirft.** Das ist die tragende Regel dieses Moduls: Eine
 * Uebersetzung, die im Zweifel nichts hinzufuegt, oeffnet den Bestand. Eine, die wirft,
 * erzeugt einen Fehler - unangenehm, aber sichtbar und ohne Datenabfluss.
 */
export function alsBedingung(sichtbarkeit: Sichtbarkeit): SQL {
  switch (sichtbarkeit.art) {
    case "alles":
      return sql`true`;
    case "nichts":
      return sql`false`;
    case "bedingung":
      return uebersetze(sichtbarkeit.bedingung);
  }
}

function uebersetze(knoten: UcastFeld): SQL {
  const spalte = FELDER[knoten.field];

  if (spalte === undefined) {
    throw new Error(`Bedingung auf unbekanntes Feld "${knoten.field}"`);
  }

  switch (knoten.operator) {
    case "in": {
      if (!Array.isArray(knoten.value) || knoten.value.some((w) => typeof w !== "string")) {
        throw new Error(
          `"in" erwartet eine Liste von Zeichenketten, erhielt ${JSON.stringify(knoten.value)}`,
        );
      }

      // **Die leere Liste heisst „nichts", nicht „kein Filter".** So antwortet die
      // Auswertung fuer einen Anwender ohne jede Mandantenzugehoerigkeit. Wer sie
      // als „nichts zu filtern" ueberspringt, gibt ihm den gesamten Bestand.
      return knoten.value.length === 0 ? sql`false` : inArray(spalte, knoten.value);
    }
    default:
      throw new Error(`Unbekannter Vergleich "${knoten.operator}"`);
  }
}
