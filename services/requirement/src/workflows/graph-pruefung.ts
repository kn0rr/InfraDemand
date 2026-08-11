import type { Bedingung, Betriebsart, Graph, Vergleich } from "./typen";
import { VERGLEICHSOPERATOREN } from "./typen";

export interface Graphfehler {
  /** Wo der Fehler liegt - Zustand, Uebergang oder der Graph als Ganzes. */
  stelle: string;
  message: string;
}

/**
 * Zu jedem erreichbaren Zustand die Menge der Zustaende, die auf **jedem** Weg vom
 * Anfangszustand dorthin liegen.
 *
 * Gebraucht fuer das Vier-Augen-Prinzip: Verweist es auf einen Zustand, der nicht auf
 * jedem Weg liegt, dann gibt es einen Pfad, auf dem niemand ihn ausgeloest hat - und der
 * Uebergang waere dort dauerhaft gesperrt. Das beim Speichern zu sagen ist ungleich
 * besser, als es beim ersten Versuch aus dem Betrieb zu erfahren.
 *
 * Gewoehnliche Fixpunktiteration. Bei Graphen dieser Groesse ist der Aufwand belanglos.
 */
function berechneDominatoren(graph: Graph): Map<string, Set<string>> {
  const unerreichbar = new Set(unerreichbareZustaende(graph));
  const erreichbar = graph.states
    .map((zustand) => zustand.key)
    .filter((schluessel) => !unerreichbar.has(schluessel));

  const dominatoren = new Map<string, Set<string>>();

  for (const zustand of erreichbar) {
    // Anfangszustand beherrscht nur sich selbst, alle anderen vorlaeufig alles.
    dominatoren.set(
      zustand,
      zustand === graph.initialState ? new Set([zustand]) : new Set(erreichbar),
    );
  }

  let geaendert = true;

  while (geaendert) {
    geaendert = false;

    for (const zustand of erreichbar) {
      if (zustand === graph.initialState) {
        continue;
      }

      const vorgaenger = graph.transitions
        .filter((uebergang) => uebergang.to === zustand && dominatoren.has(uebergang.from))
        .map((uebergang) => uebergang.from);

      if (vorgaenger.length === 0) {
        continue;
      }

      let schnitt: Set<string> | undefined;

      for (const vorgaenger_ of vorgaenger) {
        const seine = dominatoren.get(vorgaenger_) ?? new Set<string>();
        schnitt =
          schnitt === undefined
            ? new Set(seine)
            : new Set([...schnitt].filter((eintrag) => seine.has(eintrag)));
      }

      const neu = new Set(schnitt ?? []);
      neu.add(zustand);

      const bisher = dominatoren.get(zustand) ?? new Set<string>();
      const unveraendert =
        neu.size === bisher.size && [...neu].every((eintrag) => bisher.has(eintrag));

      if (!unveraendert) {
        dominatoren.set(zustand, neu);
        geaendert = true;
      }
    }
  }

  return dominatoren;
}

/**
 * Passen Operator und Wert zusammen?
 *
 * Nur das Graphlokale. **Ob es das Feld gibt, prueft der Service** - die
 * Attributdefinitionen sind Laufzeitdaten, und dieses Modul haengt bewusst an nichts
 * (ADR-0024 Punkt 8).
 */
function pruefeVergleich(vergleich: Vergleich, stelle: string): Graphfehler[] {
  const fehler: Graphfehler[] = [];

  if (vergleich.feld.length === 0) {
    fehler.push({ stelle, message: "Ein Vergleich braucht ein Feld" });
  }

  if (!(VERGLEICHSOPERATOREN as readonly string[]).includes(vergleich.operator)) {
    fehler.push({ stelle, message: `"${vergleich.operator}" ist kein bekannter Vergleich` });
    return fehler;
  }

  if (vergleich.operator === "istEinesVon" && !Array.isArray(vergleich.wert)) {
    fehler.push({ stelle, message: "istEinesVon erwartet eine Liste" });
  }

  if (vergleich.operator === "istGefuellt" && typeof vergleich.wert !== "boolean") {
    fehler.push({ stelle, message: "istGefuellt erwartet true oder false" });
  }

  if (
    (vergleich.operator === "mindestens" || vergleich.operator === "hoechstens") &&
    typeof vergleich.wert !== "number" &&
    typeof vergleich.wert !== "string"
  ) {
    fehler.push({
      stelle,
      message: `${vergleich.operator} erwartet eine Zahl oder ein Datum`,
    });
  }

  return fehler;
}

interface Bedingungskontext {
  bekannt: ReadonlySet<string>;
  /**
   * Zustaende, die auf jedem Weg zum Ausgangszustand dieses Uebergangs liegen.
   * `undefined`, wenn der Ausgangszustand gar nicht erreichbar ist - dann meldet
   * `unerreichbareZustaende` bereits das Wesentliche.
   */
  beherrschend: ReadonlySet<string> | undefined;
  stelle: string;
}

/**
 * Prueft die Bedingungen eines Uebergangs (ADR-0024).
 *
 * Was hier auffaellt, faellt beim Speichern auf. Eine Bedingung, die auf einen Zustand
 * verweist, den es nicht gibt, koennte sonst nie erfuellt werden - und der Uebergang
 * waere dauerhaft gesperrt, ohne dass jemand sieht, warum.
 */
function pruefeBedingungen(
  bedingungen: readonly Bedingung[],
  kontext: Bedingungskontext,
): Graphfehler[] {
  const fehler: Graphfehler[] = [];

  for (const [index, bedingung] of bedingungen.entries()) {
    const stelle = `${kontext.stelle}.bedingungen[${index}]`;

    for (const [nummer, vergleich] of (bedingung.nurWenn ?? []).entries()) {
      fehler.push(...pruefeVergleich(vergleich, `${stelle}.nurWenn[${nummer}]`));
    }

    switch (bedingung.art) {
      case "rolle":
        if (!Array.isArray(bedingung.eineVon) || bedingung.eineVon.length === 0) {
          fehler.push({ stelle, message: "Eine Rollenbedingung braucht mindestens eine Rolle" });
        }
        break;

      case "vier_augen": {
        const zustand = bedingung.andersAlsBeiEintritt;

        if (typeof zustand !== "string" || zustand.length === 0) {
          fehler.push({ stelle, message: "Ein Vier-Augen-Bezug braucht einen Zustand" });
          break;
        }
        // ... wie bisher

        if (kontext.beherrschend !== undefined && !kontext.beherrschend.has(zustand)) {
          fehler.push({
            stelle,
            message: `"${zustand}" liegt nicht auf jedem Weg hierher - auf mindestens einem Pfad hat ihn niemand ausgeloest, und der Uebergang waere dort gesperrt`,
          });
        }
        break;
      }

      case "identitaet":
        if (typeof bedingung.feld !== "string" || bedingung.feld.length === 0) {
          fehler.push({ stelle, message: "Eine Identitaetsbedingung braucht ein Feld" });
        }
        break;

      case "pflichtfelder":
        if (!Array.isArray(bedingung.felder) || bedingung.felder.length === 0) {
          fehler.push({ stelle, message: "Eine Pflichtfeldbedingung braucht mindestens ein Feld" });
        }
        break;

      case "feldwert":
        fehler.push(
          ...pruefeVergleich(
            { feld: bedingung.feld, operator: bedingung.operator, wert: bedingung.wert },
            stelle,
          ),
        );
        break;

      case "begruendung":
        if (bedingung.mindestlaenge !== undefined && bedingung.mindestlaenge < 1) {
          fehler.push({ stelle, message: "Eine Mindestlaenge unter 1 wirkt nie" });
        }
        break;

      default:
        // Unbekannte Art: abweisen statt uebergehen. Eine Bedingung, die niemand prueft,
        // sieht aus wie eine Zusicherung und ist keine.
        fehler.push({
          stelle,
          message: `"${(bedingung as { art: string }).art}" ist keine bekannte Bedingungsart`,
        });
    }
  }

  return fehler;
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

  // Nur berechnen, wenn ein Vier-Augen-Bezug es braucht.
  const dominatoren = graph.transitions.some((uebergang) =>
    (uebergang.bedingungen ?? []).some((bedingung) => bedingung.art === "vier_augen"),
  )
    ? berechneDominatoren(graph)
    : undefined;

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

    const bedingungen = uebergang.bedingungen ?? [];

    if (bedingungen.length > 0 && betriebsart === "external") {
      // Bei fremdgefuehrten Workflows entscheidet das Fremdsystem (ADR-0021 Punkt 4). Eine
      // Bedingung wuerde hier nie ausgewertet - sie saehe aus wie eine Zusicherung und
      // waere keine. Deshalb abweisen und nicht stillschweigend hinnehmen.
      fehler.push({
        stelle: `transitions[${index}].bedingungen`,
        message:
          "Ein fremdgefuehrter Workflow entscheidet Uebergaenge nicht selbst - Bedingungen bleiben wirkungslos",
      });
    }

    fehler.push(
      ...pruefeBedingungen(bedingungen, {
        bekannt,
        beherrschend: dominatoren?.get(uebergang.from),
        stelle: `transitions[${index}]`,
      }),
    );
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
/**
 * Alle Felder, die Bedingungen dieses Graphen nennen - mit Fundstelle.
 *
 * Getrennt von `pruefeGraph`, weil die Antwort dort nicht zu treffen ist: Ob es ein Feld
 * gibt, steht in den Attributdefinitionen, und die sind Laufzeitdaten (ADR-0024 Punkt 8).
 * Dieses Modul liefert die Frage, der Service die Antwort.
 */
export function genannteFelder(graph: Graph): { feld: string; stelle: string }[] {
  const gefunden: { feld: string; stelle: string }[] = [];

  for (const [index, uebergang] of graph.transitions.entries()) {
    for (const [nummer, bedingung] of (uebergang.bedingungen ?? []).entries()) {
      const stelle = `transitions[${index}].bedingungen[${nummer}]`;

      for (const vergleich of bedingung.nurWenn ?? []) {
        gefunden.push({ feld: vergleich.feld, stelle: `${stelle}.nurWenn` });
      }

      if (bedingung.art === "identitaet" || bedingung.art === "feldwert") {
        gefunden.push({ feld: bedingung.feld, stelle });
      }

      if (bedingung.art === "pflichtfelder") {
        for (const feld of bedingung.felder) {
          gefunden.push({ feld, stelle });
        }
      }
    }
  }

  return gefunden;
}
