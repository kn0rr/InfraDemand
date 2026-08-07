/**
 * Ableitung der Feldherkunft aus der Versionshistorie (§19.3, ADR-0011 Punkt 4).
 *
 * Bewusst keine gespeicherte Karte am Datensatz: Das waere eine zweite Darstellung
 * dessen, was die Historie bereits enthaelt, und ADR-0012 Punkt 5 haelt fest, dass genau
 * das nicht entstehen soll. Entscheidend ist die Art des Versagens - eine gespeicherte
 * Karte, die einmal aus dem Tritt geraet, laesst die Regel danach lautlos falsch
 * entscheiden. Eine Ableitung kann nicht abweichen.
 */

/** Ein Versionsstand, flach auf Felder abgebildet. */
export interface Feldstand {
  werte: Record<string, unknown>;
  /** Quelle **dieser Aenderung**, nicht Herkunft des Datensatzes. */
  changeSource: string;
}

/**
 * Vergleich zweier Feldwerte.
 *
 * Die zulaessigen Datentypen sind skalar oder Listen von Zeichenketten (§6) - es gibt
 * keine verschachtelten Objekte, deren Schluesselreihenfolge zaehlen wuerde. Eine
 * umsortierte Liste gilt als Aenderung; das ist bei `multi_enum` streng genommen eine
 * Menge, die Unterscheidung waere hier aber Aufwand ohne Ertrag.
 */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Welche Quelle den aktuellen Wert eines Feldes gesetzt hat.
 *
 * `versionen` muss **aufsteigend nach Versionsnummer** sortiert sein. Liefert
 * `undefined`, wenn das Feld nie einen Wert trug.
 */
export function letzteQuelleFuerFeld(
  versionen: readonly Feldstand[],
  feld: string,
): string | undefined {
  let quelle: string | undefined;
  let vorheriger: unknown = null;

  for (const stand of versionen) {
    const jetzt = stand.werte[feld];

    if (!gleich(jetzt, vorheriger)) {
      quelle = stand.changeSource;
    }

    vorheriger = jetzt;
  }

  // Ein Feld, das zuletzt geleert wurde, hat keinen aktuellen Wert - und damit auch
  // keine Quelle, die ihn haelt.
  const letzter = versionen.at(-1);
  if (letzter === undefined || gleich(letzter.werte[feld], null)) {
    return undefined;
  }

  return quelle;
}
/** Der fachliche Zustand eines Datensatzes, soweit er Felder traegt. */
export interface Datensatzstand {
  projectId: string;
  requirementType: string;
  status: string;
  owner: string;
  dynamicAttributes: Record<string, unknown>;
}

/**
 * Bildet einen Datensatz flach auf Felder ab.
 *
 * Der Feldraum ist flach: `owner` bezeichnet dasselbe, ob Kernfeld oder Attributschluessel
 * (ADR-0017). Dass ein Attribut ein Kernfeld verdecken koennte, ist ausgeschlossen - die
 * Attributdefinition weist solche Schluessel ab.
 */
export function feldwerte(stand: Datensatzstand): Record<string, unknown> {
  return {
    projectId: stand.projectId,
    requirementType: stand.requirementType,
    status: stand.status,
    owner: stand.owner,
    ...stand.dynamicAttributes,
  };
}
