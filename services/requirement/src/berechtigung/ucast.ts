import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { requirementHistory, requirements } from "../database/schema";
import type { Sichtbarkeit, UcastFeld, UcastKnoten, UcastVerbund } from "./sichtbarkeit.typen";

/**
 * Bildet die Feldnamen der Richtlinie auf Spalten ab.
 *
 * Kein dynamisches Nachschlagen: Ein unbekanntes Feld ist ein Fehler und keine Bedingung,
 * die man weglassen koennte. Weglassen hiesse „kein Filter", und damit waere aus einer
 * nicht verstandenen Richtlinie eine Freigabe geworden.
 */
export type Feldabbildung = Readonly<Record<string, PgColumn>>;

/**
 * **Eine Richtlinie, zwei Abbildungen.** Der aktuelle Bestand und die Historie tragen
 * dieselben fachlichen Felder in verschiedenen Tabellen. Eine zweite Regel mit eigenen
 * Feldnamen waere eine zweite Fassung der Berechtigungslogik - und wer eine Bedingung nur
 * in einer von beiden ergaenzt, oeffnet die Historie.
 */
export const FELDER_BESTAND: Feldabbildung = {
  "requirement.tenant": requirements.tenant,
  "requirement.owner": requirements.owner,
  "requirement.responsible_group": requirements.responsibleGroup,
};

export const FELDER_HISTORIE: Feldabbildung = {
  "requirement.tenant": requirementHistory.tenant,
  "requirement.owner": requirementHistory.owner,
  "requirement.responsible_group": requirementHistory.responsibleGroup,
};

/**
 * Uebersetzt die Auskunft in eine Bedingung fuer die Abfrage.
 *
 * **Jeder nicht behandelte Fall wirft.** Das ist die tragende Regel dieses Moduls: Eine
 * Uebersetzung, die im Zweifel nichts hinzufuegt, oeffnet den Bestand. Eine, die wirft,
 * erzeugt einen Fehler - unangenehm, aber sichtbar und ohne Datenabfluss.
 */
export function alsBedingung(sichtbarkeit: Sichtbarkeit, felder: Feldabbildung): SQL {
  switch (sichtbarkeit.art) {
    case "alles":
      return sql`true`;
    case "nichts":
      return sql`false`;
    case "bedingung":
      return uebersetze(sichtbarkeit.bedingung, felder);
  }
}

function uebersetze(knoten: UcastKnoten, felder: Feldabbildung): SQL {
  if (knoten.type === "compound") {
    return uebersetzeVerbund(knoten, felder);
  }

  if (knoten.type === "field") {
    return uebersetzeFeld(knoten, felder);
  }

  throw new Error(`Unbekannte Knotenart: ${JSON.stringify(knoten)}`);
}

function uebersetzeVerbund(knoten: UcastVerbund, felder: Feldabbildung): SQL {
  // Ein leerer Verbund entsteht in der Auswertung nicht - erfuellbare Zweige bleiben,
  // unerfuellbare fallen weg und der Knoten kollabiert. Kaeme er doch, waere unklar,
  // ob er "wahr" oder "falsch" bedeutet, und Raten ist hier die falsche Antwort.
  if (knoten.value.length === 0) {
    throw new Error(`Leerer Verbund "${knoten.operator}"`);
  }

  const teile = knoten.value.map((kind) => uebersetze(kind as UcastKnoten, felder));

  switch (knoten.operator) {
    case "and":
      return pflicht(and(...teile), "and");
    case "or":
      return pflicht(or(...teile), "or");
    default:
      throw new Error(`Unbekannte Verknuepfung "${knoten.operator}"`);
  }
}

function uebersetzeFeld(knoten: UcastFeld, felder: Feldabbildung): SQL {
  const spalte = felder[knoten.field];

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
    case "eq": {
      if (typeof knoten.value !== "string") {
        throw new Error(`"eq" erwartet eine Zeichenkette, erhielt ${JSON.stringify(knoten.value)}`);
      }

      return eq(spalte, knoten.value);
    }
    default:
      throw new Error(`Unbekannter Vergleich "${knoten.operator}"`);
  }
}

/** `and`/`or` liefern bei leerer Liste `undefined`; oben ist das bereits ausgeschlossen. */
function pflicht(bedingung: SQL | undefined, name: string): SQL {
  if (bedingung === undefined) {
    throw new Error(`Verknuepfung "${name}" ergab keine Bedingung`);
  }

  return bedingung;
}
