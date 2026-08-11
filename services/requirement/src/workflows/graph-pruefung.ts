import type { Betriebsart, Graph } from "./typen";

export interface Graphfehler {
  /** Wo der Fehler liegt - Zustand, Uebergang oder der Graph als Ganzes. */
  stelle: string;
  message: string;
}

/**
 * Prueft einen Zustandsgraphen auf Widersprueche (§7).
 *
 * **Warum das nicht bis zur Laufzeit warten darf:** Ein Uebergang, der auf einen nicht
 * vorhandenen Zustand zeigt, faellt erst auf, wenn ihn jemand benutzt - und dann steckt
 * eine Anforderung in einem Zustand fest, den es nicht gibt.
 *
 * **Zur Betriebsart (ADR-0021 Punkt 4):** Strukturelle Widersprueche gelten immer.
 * Vollstaendigkeit - keine Sackgassen, Endzustaende ohne Ausgang - wird nur bei
 * `internal` verlangt. Bei `external` beschreibt der Graph nur; er darf Zustaende ohne
 * Uebergaenge auffuehren, weil das Fremdsystem die Uebergaenge entscheidet.
 *
 * Sammelt alle Befunde statt beim ersten abzubrechen.
 */
export function pruefeGraph(graph: Graph, betriebsart: Betriebsart): Graphfehler[] {
  const fehler: Graphfehler[] = [];
  const schluessel = graph.states.map((zustand) => zustand.key);
  const bekannt = new Set(schluessel);

  if (graph.states.length === 0) {
    fehler.push({ stelle: "states", message: "Ein Workflow braucht mindestens einen Zustand" });
  }

  for (const [index, wert] of schluessel.entries()) {
    if (schluessel.indexOf(wert) !== index) {
      fehler.push({
        stelle: `states[${index}]`,
        message: `Zustand "${wert}" ist mehrfach angelegt`,
      });
    }
  }

  if (!bekannt.has(graph.initialState)) {
    fehler.push({
      stelle: "initialState",
      message: `Anfangszustand "${graph.initialState}" ist kein angelegter Zustand`,
    });
  }

  const gesehen = new Set<string>();

  for (const [index, uebergang] of graph.transitions.entries()) {
    if (!bekannt.has(uebergang.from)) {
      fehler.push({
        stelle: `transitions[${index}].from`,
        message: `"${uebergang.from}" ist kein angelegter Zustand`,
      });
    }

    if (!bekannt.has(uebergang.to)) {
      fehler.push({
        stelle: `transitions[${index}].to`,
        message: `"${uebergang.to}" ist kein angelegter Zustand`,
      });
    }

    if (uebergang.from === uebergang.to) {
      fehler.push({
        stelle: `transitions[${index}]`,
        message: `Ein Uebergang von "${uebergang.from}" auf sich selbst bewirkt nichts`,
      });
    }

    const kennung = `${uebergang.from}\u0000${uebergang.to}`;
    if (gesehen.has(kennung)) {
      fehler.push({
        stelle: `transitions[${index}]`,
        message: `Es gibt bereits einen Uebergang von "${uebergang.from}" nach "${uebergang.to}"`,
      });
    }
    gesehen.add(kennung);
  }

  // Ab hier nur noch Vollstaendigkeit - und die verlangt nur, wer auch entscheidet.
  if (betriebsart === "external") {
    return fehler;
  }

  for (const zustand of graph.states) {
    const hatAusgang = graph.transitions.some((uebergang) => uebergang.from === zustand.key);
    const stelle = `states[${schluessel.indexOf(zustand.key)}]`;

    if (zustand.final === true && hatAusgang) {
      fehler.push({
        stelle,
        message: `"${zustand.key}" ist als Endzustand angelegt, hat aber einen ausgehenden Uebergang`,
      });
    }

    if (zustand.final !== true && !hatAusgang && graph.states.length > 1) {
      fehler.push({
        stelle,
        message: `Aus "${zustand.key}" fuehrt kein Uebergang heraus - entweder als Endzustand kennzeichnen oder einen Uebergang anlegen`,
      });
    }
  }

  return fehler;
}

/**
 * Ist ein Zustand vom Anfangszustand aus erreichbar?
 *
 * Getrennt von `pruefeGraph`, weil Unerreichbarkeit kein Widerspruch ist: Ein Zustand,
 * den man noch nicht verbunden hat, ist ein unfertiger Graph und kein falscher. Die
 * Verwaltung kann darauf hinweisen, ohne das Speichern zu verhindern.
 */
export function unerreichbareZustaende(graph: Graph): string[] {
  const erreichbar = new Set<string>([graph.initialState]);
  const offen = [graph.initialState];

  while (offen.length > 0) {
    const aktuell = offen.pop();

    for (const uebergang of graph.transitions) {
      if (uebergang.from === aktuell && !erreichbar.has(uebergang.to)) {
        erreichbar.add(uebergang.to);
        offen.push(uebergang.to);
      }
    }
  }

  return graph.states.map((zustand) => zustand.key).filter((wert) => !erreichbar.has(wert));
}
