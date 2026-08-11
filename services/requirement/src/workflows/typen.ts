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
 * Ein Uebergang zwischen zwei Zustaenden.
 *
 * Bedingungen - Pflichtfelder, benoetigte Berechtigung - kommen mit M4.3 hinzu. Weil der
 * Graph ein JSONB-Wert ist, ist das eine Erweiterung dieser Schnittstelle und keine
 * Migration.
 */
export interface WorkflowTransition {
  from: string;
  to: string;
  label: string;
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
