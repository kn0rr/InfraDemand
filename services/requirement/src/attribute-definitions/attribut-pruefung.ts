import type { AttributeDefinitionRow } from "../database/schema";

/**
 * Was die Pruefung von einer Attributdefinition braucht - und nicht mehr.
 *
 * Bewusst nicht `AttributeDefinitionRow`: Der Requirement-Service bekaeme sonst
 * Datenbankzeilen des Attribut-Service gereicht, und die verlassen ihr Repository nicht
 * (Schichtung, siehe README des Service). Der Datentyp wird als *Typ* aus dem Schema
 * abgeleitet, damit es die Aufzaehlung nicht zweimal gibt.
 */
export interface GeltendeDefinition {
  key: string;
  label: string;
  dataType: AttributeDefinitionRow["dataType"];
  required: boolean;
  defaultValue: unknown;
  allowedValues: string[] | null;
  /** Rollen, die das Attribut sehen duerfen. Leer heisst: alle (ADR-0030 Punkt 3). */
  visibleFor: string[] | null;
}

export interface AttributFehler {
  key: string;
  message: string;
}

export interface PruefErgebnis {
  /**
   * Die uebernommenen Werte. Enthaelt ausschliesslich definierte Attribute, ergaenzt um
   * Vorgabewerte und ohne leere optionale - `dynamic_attributes` traegt damit nie einen
   * Schluessel, den keine Definition erklaert.
   */
  werte: Record<string, unknown>;
  fehler: AttributFehler[];
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Prueft eine Zeichenkette als Kalenderdatum.
 *
 * Der Rueckvergleich ist nicht ueberfluessig: JavaScript liefert fuer `2026-02-31` kein
 * `NaN`, sondern stillschweigend den 3. Maerz. Nur der Monatsueberlauf (`2026-13-01`)
 * erzeugt `NaN`. Ohne den Vergleich gingen ungueltige Tagesangaben durch und wuerden
 * beim Lesen zu einem anderen Datum.
 */
function istKalenderdatum(wert: unknown): boolean {
  if (typeof wert !== "string" || !ISO_DATUM.test(wert)) {
    return false;
  }

  const zeit = Date.parse(`${wert}T00:00:00.000Z`);
  if (Number.isNaN(zeit)) {
    return false;
  }

  return new Date(zeit).toISOString().startsWith(wert);
}

/** Fehlend im fachlichen Sinn - nicht nur `undefined`. */
function istLeer(wert: unknown): boolean {
  return (
    wert === undefined || wert === null || wert === "" || (Array.isArray(wert) && wert.length === 0)
  );
}

function pruefeWert(wert: unknown, definition: GeltendeDefinition): string | null {
  const name = definition.label;

  switch (definition.dataType) {
    case "text":
      return typeof wert === "string" ? null : `"${name}" erwartet Text`;

    case "person":
      // Wie Text geprueft - und mehr ist es bis M6 auch nicht: Es gibt kein Verzeichnis,
      // gegen das ein Benutzername zu pruefen waere (ADR-0031 Punkt 5). Der Typ traegt
      // seine Bedeutung in der Verwendung, nicht in der Validierung: `identitaet` darf
      // nur ein solches Feld nennen.
      return typeof wert === "string" ? null : `"${name}" erwartet einen Benutzernamen`;

    case "number":
      return typeof wert === "number" && Number.isFinite(wert)
        ? null
        : `"${name}" erwartet eine Zahl`;

    case "boolean":
      return typeof wert === "boolean" ? null : `"${name}" erwartet ja oder nein`;

    case "date":
      return istKalenderdatum(wert) ? null : `"${name}" erwartet ein Datum im Format JJJJ-MM-TT`;

    case "enum": {
      const zulaessig = definition.allowedValues ?? [];
      return typeof wert === "string" && zulaessig.includes(wert)
        ? null
        : `"${name}" erwartet einen der Werte: ${zulaessig.join(", ")}`;
    }

    case "multi_enum": {
      const zulaessig = definition.allowedValues ?? [];

      if (!Array.isArray(wert)) {
        return `"${name}" erwartet eine Liste`;
      }

      const unzulaessig = wert.filter(
        (eintrag) => typeof eintrag !== "string" || !zulaessig.includes(eintrag),
      );
      if (unzulaessig.length > 0) {
        return `"${name}" enthaelt unzulaessige Werte: ${unzulaessig.join(", ")}`;
      }

      if (new Set(wert).size !== wert.length) {
        return `"${name}" enthaelt Wiederholungen`;
      }

      return null;
    }
  }
}

/**
 * Prueft dynamische Attribute gegen die geltenden Definitionen (§6).
 *
 * **Der einzige Pruefpfad.** §19.2 verlangt, dass Schnittstelle, Dateiimport und manuelle
 * Erfassung dieselbe Validierung durchlaufen; zwei Wege laufen auseinander, und der
 * seltener genutzte ist der schwaechere. Diese Funktion ist deshalb frei von Nest und
 * Datenbank - sie kann von jedem Eingangsweg aufgerufen werden.
 *
 * Sammelt **alle** Fehler statt beim ersten abzubrechen: Ein Formular soll alle
 * beanstandeten Felder auf einmal anzeigen, nicht eines nach dem anderen.
 */
export function pruefeDynamischeAttribute(
  werte: Record<string, unknown>,
  definitionen: readonly GeltendeDefinition[],
): PruefErgebnis {
  const fehler: AttributFehler[] = [];
  const uebernommen: Record<string, unknown> = {};
  const bekannt = new Map(definitionen.map((eintrag) => [eintrag.key, eintrag]));

  for (const key of Object.keys(werte)) {
    if (!bekannt.has(key)) {
      fehler.push({
        key,
        message: `"${key}" ist fuer diesen Anforderungstyp nicht definiert`,
      });
    }
  }

  for (const definition of definitionen) {
    const wert = Object.hasOwn(werte, definition.key)
      ? werte[definition.key]
      : definition.defaultValue;

    if (istLeer(wert)) {
      if (definition.required) {
        fehler.push({
          key: definition.key,
          message: `"${definition.label}" ist erforderlich`,
        });
      }
      // Leere optionale Attribute werden nicht geschrieben - ein Schluessel mit null
      // waere von einem bewusst gesetzten Wert nicht zu unterscheiden.
      continue;
    }

    const meldung = pruefeWert(wert, definition);
    if (meldung !== null) {
      fehler.push({ key: definition.key, message: meldung });
      continue;
    }

    uebernommen[definition.key] = wert;
  }

  return { werte: uebernommen, fehler };
}
