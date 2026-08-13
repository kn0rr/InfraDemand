import type { Pool } from "pg";

export interface TestWorkflow {
  id: string;
  version: number;
}

/**
 * Legt einen Workflow an und liefert die Bindung, die jede Anforderung braucht
 * (ADR-0022 Punkt 2).
 *
 * Dieselbe Ueberlegung wie bei `registriereQuelle`: Ohne Eintrag weist der
 * Fremdschluessel ab, und der Test scheitert an seiner Einrichtung statt an seiner
 * Aussage.
 *
 * **Schreibt beide Zeilen - Fachtabelle und Historie.** Eine Anforderung ist an
 * Kennung *und* Fassung gebunden, und die Fassung steht in der Historie. Ein Workflow
 * ohne Historienzeile ist deshalb kein unvollstaendiger Testaufbau, sondern einer, an
 * dem keine Anforderung laufen kann.
 *
 *  * **Der einzige Weg, im Test einen Workflow anzulegen.** Wer daneben eigenes SQL
 * schreibt, vergisst die Historienzeile - und der Fehler zeigt sich erst als 500 beim
 * ersten Zustandswechsel, weit entfernt von seiner Ursache.
 */
/** Abweichungen vom Standardgraphen. Alles Weggelassene bleibt wie oben beschrieben. */
export interface Workflowvorgabe {
  mode: "internal" | "external";
  initialState: string;
  states: unknown[];
  transitions: unknown[];
  tenant: string | null;
}

export async function registriereWorkflow(
  pool: Pool,
  requirementType: string | null = null,
  abweichend: Partial<Workflowvorgabe> = {},
): Promise<TestWorkflow> {
  const vorgabe: Workflowvorgabe = {
    mode: "internal",
    initialState: "neu",
    tenant: null,
    states: [
      { key: "neu", label: "Neu" },
      { key: "in_pruefung", label: "In Pruefung" },
      { key: "erledigt", label: "Erledigt", final: true },
    ],
    transitions: [
      { from: "neu", to: "in_pruefung", label: "Einreichen" },
      { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
    ],
    ...abweichend,
  };

  const { rows } = await pool.query<{ id: string; version: number }>(
    `INSERT INTO workflow_definition
       (label, tenant, requirement_type, mode, initial_state, states, transitions)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      ON CONFLICT ON CONSTRAINT workflow_definition_tenant_requirement_type_uq
       DO UPDATE SET label = EXCLUDED.label
     RETURNING id, version`,
    [
      requirementType === null ? "Allgemeiner Ablauf" : `Ablauf ${requirementType}`,
      vorgabe.tenant,
      requirementType,
      vorgabe.mode,
      vorgabe.initialState,
      JSON.stringify(vorgabe.states),
      JSON.stringify(vorgabe.transitions),
    ],
  );

  const zeile = rows[0];

  if (zeile === undefined) {
    throw new Error("Workflow-Anlage lieferte keine Zeile zurueck");
  }

  // Aus der Fachtabelle abgeschrieben statt noch einmal aufgezaehlt: So kann die
  // Historie nicht von dem abweichen, was tatsaechlich gespeichert wurde.
  await pool.query(
    `INSERT INTO workflow_definition_history
      (id, label, tenant, requirement_type, mode, initial_state, states, transitions, active,
        created_at, updated_at, version, valid_from, valid_to, operation,
        changed_by, change_source)
          SELECT id, label, tenant, requirement_type, mode, initial_state, states, transitions, active,
            created_at, updated_at, version, updated_at, NULL, 'insert',
            'test-fixture', 'test-fixture'
       FROM workflow_definition
      WHERE id = $1
     ON CONFLICT ON CONSTRAINT workflow_definition_history_id_version_uq DO NOTHING`,
    [zeile.id],
  );

  return { id: zeile.id, version: zeile.version };
}
