/**
 * Auswahl der spezifischsten Definition (ADR-0026 Punkt 5).
 *
 * Ein neues Verzeichnis, weil die Regel drei Bereiche betrifft - Attributdefinitionen,
 * Hoheitsregeln und Workflows. Sie in jedem einzeln zu fuehren hiesse, sie dreimal zu
 * pflegen, und die dritte Fassung waere irgendwann eine andere.
 *
 * Haengt von nichts ab: kein NestJS, keine Datenbank. Die Datenbank filtert die
 * Kandidaten, die Auswahl trifft dieser Code - so ist die Rangfolge an einer Stelle
 * lesbar statt in drei `ORDER BY`.
 */

export interface Gestuft {
  /** Mandant, fuer den der Eintrag gilt. `null` bedeutet: fuer alle. */
  tenant: string | null;
  /**
   * Anforderungsart, fuer die der Eintrag gilt. `null` bedeutet: fuer alle.
   * Fehlt die Angabe ganz, kennt der Eintrag diese Dimension nicht - so bei den
   * Hoheitsregeln, die nach ADR-0017 A5 fuer alle Anforderungen gelten.
   */
  requirementType?: string | null;
}

/**
 * Rang eines Eintrags, kleiner ist spezifischer.
 *
 * | Rang | Mandant | Anforderungsart |
 * |---|---|---|
 * | 0 | dieser | diese |
 * | 1 | alle | diese |
 * | 2 | dieser | alle |
 * | 3 | alle | alle |
 *
 * **Die Anforderungsart wiegt schwerer als der Mandant.** Sonst hebelte die allgemeine
 * Regel eines Mandanten einen plattformweiten Prozess fuer eine bestimmte Art aus, ohne
 * dass jemand ueber diese Art gesprochen haette (ADR-0026, Begruendung zu 5).
 */
function rang(eintrag: Gestuft): number {
  const artOffen = eintrag.requirementType === null || eintrag.requirementType === undefined;
  const mandantOffen = eintrag.tenant === null;

  return (artOffen ? 2 : 0) + (mandantOffen ? 1 : 0);
}

/** Der spezifischste Eintrag, oder `undefined` bei leerer Auswahl. */
export function spezifischste<T extends Gestuft>(kandidaten: readonly T[]): T | undefined {
  return [...kandidaten].sort((a, b) => rang(a) - rang(b))[0];
}

/**
 * Je Schluessel genau ein Eintrag - der spezifischste.
 *
 * **Nicht alle anzuwenden ist der Kern der Sache.** Zwei Definitionen fuer denselben
 * Schluessel sind nicht zwei Regeln, sondern zwei Antworten auf dieselbe Frage; beide
 * anzuwenden kann zu einer unerfuellbaren Verbindung fuehren, ohne dass irgendwo eine
 * Meldung entsteht.
 */
export function spezifischsteJe<T extends Gestuft>(
  kandidaten: readonly T[],
  schluessel: (eintrag: T) => string,
): T[] {
  const beste = new Map<string, T>();

  for (const eintrag of kandidaten) {
    const name = schluessel(eintrag);
    const bisher = beste.get(name);

    if (bisher === undefined || rang(eintrag) < rang(bisher)) {
      beste.set(name, eintrag);
    }
  }

  return [...beste.values()];
}
