/**
 * Begriffe der Workflow-Maschine (§7).
 *
 * Diese Datei haengt **von nichts ab** - kein NestJS, kein Drizzle, keine Datenbank. Das
 * ist Absicht: Nach [ADR-0020](../../../../docs/adr/0020-lebenszyklus-der-infrastruktur.md)
 * Punkt 9 bekommt die Workflow-Maschine mit M6 einen zweiten Konsumenten im
 * Infrastructure Service und wandert dann nach `packages/`. Zeigte die Abhaengigkeit in
 * die Gegenrichtung - Workflow importiert Schema -, waere das kein Verschieben mehr.
 *
 * `schema.ts` importiert von hier, nicht umgekehrt.
 */

/** Ein Zustand im Workflow (§7). */
export interface WorkflowState {
  key: string;
  label: string;
  /** Endzustand - von hier fuehrt kein Uebergang weiter. */
  final?: boolean;
}

/**
 * Vergleichsoperatoren (ADR-0024).
 *
 * Als Liste, damit Pruefer, DTO und Oberflaeche dieselbe Quelle haben. Ein neuer Operator
 * ist ein Wert hier und ein Fall im Pruefer - und ausdruecklich Code, nicht Konfiguration.
 */
export const VERGLEICHSOPERATOREN = [
  "istGleich",
  "istUngleich",
  "mindestens",
  "hoechstens",
  "istEinesVon",
  "istGefuellt",
] as const;
export type Vergleichsoperator = (typeof VERGLEICHSOPERATOREN)[number];

/**
 * Ein Vergleich ueber einen Feldwert.
 *
 * Bewusst drei Felder statt des Operators als Schluessel: So ist jeder Vergleich gleich
 * gebaut, mit einer Auswahlliste bedienbar und ohne Sonderlogik pruefbar.
 */
export interface Vergleich {
  /** Kernfeld oder dynamisches Attribut. Ob es existiert, prueft der Service. */
  feld: string;
  operator: Vergleichsoperator;
  /** `istEinesVon` erwartet eine Liste, `istGefuellt` einen Wahrheitswert. */
  wert: unknown;
}

export const WORKFLOW_BEDINGUNGSARTEN = [
  "rolle",
  "vier_augen",
  "identitaet",
  "pflichtfelder",
  "feldwert",
  "begruendung",
] as const;
export type Bedingungsart = (typeof WORKFLOW_BEDINGUNGSARTEN)[number];

/**
 * Jede Bedingung ist eine Implikation: `nurWenn` -> Anforderung.
 *
 * Ohne `nurWenn` gilt sie immer. Die Bedingungen eines Uebergangs werden mit UND
 * verknuepft - **das ODER entsteht dadurch von selbst**: Zwei Bedingungen mit derselben
 * Anforderung ergeben zusammen „A oder B, dann Anforderung".
 */
interface MitVorbehalt {
  /** Alle Vergleiche muessen gelten, damit die Bedingung ueberhaupt greift. */
  nurWenn?: Vergleich[];
}

/** Der Ausloesende traegt mindestens eine dieser Realm-Rollen. */
export interface RollenBedingung extends MitVorbehalt {
  art: "rolle";
  eineVon: string[];
}

/**
 * Der Ausloesende ist **nicht** die Person, die den Eintritt in diesen Zustand ausgeloest
 * hat (§7 Vier-Augen-Prinzip).
 *
 * Der Bezug ist ein Zustand und nicht „der vorherige Uebergang": Sonst haenge die
 * Bedeutung an der Form des Graphen und aenderte sich bei jeder Einfuegung stillschweigend.
 *
 * „Nicht der Ersteller" braucht keine eigene Art - der Anfangszustand wird beim Anlegen
 * betreten.
 */
export interface VierAugenBedingung extends MitVorbehalt {
  art: "vier_augen";
  andersAlsBeiEintritt: string;
}

/** Der Ausloesende ist die im Feld genannte Person - etwa `owner`. */
export interface IdentitaetsBedingung extends MitVorbehalt {
  art: "identitaet";
  feld: string;
}

/**
 * Diese Felder sind gefuellt.
 *
 * Getrennt von `required` der Attributdefinition (§6): Dort steht, **was diese Art von
 * Anforderung hat**; hier, **was gefuellt sein muss, um hier weiterzukommen**. Eine
 * Begruendung, die erst zur Einreichung Pflicht wird, ist am Attribut nicht ausdrueckbar.
 */
export interface PflichtfeldBedingung extends MitVorbehalt {
  art: "pflichtfelder";
  felder: string[];
}

/** Das Feld erfuellt den Vergleich. */
export interface FeldwertBedingung extends MitVorbehalt {
  art: "feldwert";
  feld: string;
  operator: Vergleichsoperator;
  wert: unknown;
}

/** Der Vorgang fuehrt eine Begruendung mit; sie landet in `change_reason`. */
export interface BegruendungsBedingung extends MitVorbehalt {
  art: "begruendung";
  mindestlaenge?: number;
}

export type Bedingung =
  | RollenBedingung
  | VierAugenBedingung
  | IdentitaetsBedingung
  | PflichtfeldBedingung
  | FeldwertBedingung
  | BegruendungsBedingung;

/**
 * Ein Uebergang zwischen zwei Zustaenden.
 *
 * Weil der Graph ein JSONB-Wert ist, waren die Bedingungen aus M4.3 eine Erweiterung
 * dieser Schnittstelle und keine Migration.
 */
export interface WorkflowTransition {
  from: string;
  to: string;
  label: string;
  /** Alle muessen erfuellt sein (ADR-0024). Fehlt die Angabe, gibt es keine. */
  bedingungen?: Bedingung[];
}

/**
 * Betriebsart eines Workflows (ADR-0021 Punkt 4).
 *
 * `internal`: Wir entscheiden die Uebergaenge; der Graph prueft und weist ab.
 * `external`: Ein Fremdsystem fuehrt, wir ziehen nach - der Graph **beschreibt** nur.
 *
 * Als Liste, damit `pgEnum` in `schema.ts` und der Typ hier nicht auseinanderlaufen
 * koennen: Ein neuer Wert steht an genau einer Stelle.
 */
export const WORKFLOW_MODES = ["internal", "external"] as const;
export type Betriebsart = (typeof WORKFLOW_MODES)[number];

export interface Graph {
  initialState: string;
  states: readonly WorkflowState[];
  transitions: readonly WorkflowTransition[];
}

/**
 * Der fuer einen Anforderungstyp geltende Workflow, zugeschnitten auf das, was ein
 * Statuswechsel braucht (M4.2). Kein Datenbanktyp - die Zeile bleibt im Repository.
 *
 * `version` gehoert dazu, weil §7 verlangt, dass eine laufende Anforderung auf ihrer
 * Ursprungsfassung bleibt: Nummer und Version zusammen zeigen auf genau eine
 * Historienzeile (M4.4).
 */
export interface GeltenderWorkflow {
  id: string;
  version: number;
  mode: Betriebsart;
  initialState: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}
