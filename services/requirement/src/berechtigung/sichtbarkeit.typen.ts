/**
 * Vokabular der Sichtbarkeitsauskunft - ohne NestJS und ohne Drizzle.
 *
 * Dasselbe Muster wie `workflows/typen.ts` (ADR-0020 Punkt 9): Das Vokabular ist die
 * Grundlage, nicht die Ableitung. Deshalb steht hier auch die Deutung der Antwort und
 * nicht im Client - sie ist pruefbar, ohne einen Server zu starten.
 */

/** Ein UCAST-Knoten, wie die Compile-API ihn liefert. */
export interface UcastFeld {
  readonly type: "field";
  readonly field: string;
  readonly operator: string;
  readonly value: unknown;
}

/**
 * Die drei Antworten der Teilauswertung - als Aufzaehlung, nicht als Nullwert.
 *
 * **Der Grund ist ein Fehler, der sich anders nicht verhindern laesst.** Die Compile-API
 * antwortet in allen drei Faellen mit HTTP 200, und „nichts sichtbar" unterscheidet sich
 * von „alles sichtbar" allein dadurch, ob `result` vorhanden ist. Ein Client, der eine
 * Bedingung *oder* `undefined` liefert, macht aus „nichts" ein „kein Filter" - und gibt
 * den gesamten Bestand heraus. Diese Aufzaehlung laesst das nicht zu: Wer `art` nicht
 * vollstaendig behandelt, uebersetzt gar nicht.
 */
export type Sichtbarkeit =
  | { readonly art: "bedingung"; readonly bedingung: UcastFeld }
  | { readonly art: "alles" }
  | { readonly art: "nichts" };

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/**
 * Deutet den Antwortrumpf der Compile-API.
 *
 * Die Zuordnung ist ausgeschrieben, weil sie nicht selbsterklaerend ist:
 *
 * | Rumpf                        | Bedeutung |
 * |------------------------------|-----------|
 * | `{}`                         | nichts    |
 * | `{"result":{"query":{}}}`    | alles     |
 * | `{"result":{"query":{...}}}` | Bedingung |
 *
 * Alles, was in keines der drei Muster passt, ist ein Fehler - **nicht** stillschweigend
 * „alles". Ein unverstandener Rumpf ist keine Erlaubnis.
 */
export function deuteAntwort(rumpf: unknown): Sichtbarkeit {
  if (!istObjekt(rumpf)) {
    throw new Error("Antwort der Auswertung ist kein Objekt");
  }

  // Fehlendes `result` heisst: unerfuellbar, also nichts sichtbar.
  if (!("result" in rumpf)) {
    return { art: "nichts" };
  }

  const ergebnis = rumpf["result"];

  if (!istObjekt(ergebnis) || !istObjekt(ergebnis["query"])) {
    throw new Error("Antwort der Auswertung enthaelt kein deutbares `result.query`");
  }

  const abfrage = ergebnis["query"];

  // Leeres `query` heisst: unbedingt wahr, also kein Filter.
  if (Object.keys(abfrage).length === 0) {
    return { art: "alles" };
  }

  if (abfrage["type"] !== "field" || typeof abfrage["field"] !== "string") {
    throw new Error(`Unbekannte Bedingungsform: ${JSON.stringify(abfrage)}`);
  }

  return { art: "bedingung", bedingung: abfrage as unknown as UcastFeld };
}
