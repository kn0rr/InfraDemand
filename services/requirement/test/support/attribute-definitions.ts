import type { Pool } from "pg";

/**
 * Traegt eine Attributdefinition unmittelbar in die Datenbank ein.
 *
 * Bewusst ohne den Umweg ueber die API: Tests des Schreibpfads sollen an ihrer eigenen
 * Aussage scheitern, nicht an der Einrichtung.
 */
export async function registriereAttribut(
  pool: Pool,
  attribut: {
    key: string;
    label?: string;
    dataType?: "text" | "number" | "boolean" | "date" | "enum" | "multi_enum";
    requirementType?: string | null;
    required?: boolean;
    allowedValues?: string[] | null;
    tenant?: string | null;
    visibleFor?: string[] | null;
  },
): Promise<void> {
  await pool.query(
    "INSERT INTO attribute_definition (key, requirement_type, label, data_type, required, allowed_values, tenant, visible_for) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING",
    [
      attribut.key,
      attribut.requirementType ?? null,
      attribut.label ?? attribut.key,
      attribut.dataType ?? "text",
      attribut.required ?? false,
      attribut.allowedValues === undefined ? null : JSON.stringify(attribut.allowedValues),
      attribut.tenant ?? null,
      attribut.visibleFor === undefined ? null : JSON.stringify(attribut.visibleFor),
    ],
  );
}
