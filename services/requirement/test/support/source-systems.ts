import type { Pool } from "pg";

/**
 * Traegt ein Herkunftssystem in die Registratur ein (ADR-0017 A4).
 *
 * Tests, die eine fremde Herkunft verwenden, muessen sie zuvor eintragen - genau wie im
 * Betrieb. Ohne Eintrag weist bereits der Fremdschluessel ab, und der Test scheitert an
 * seiner Einrichtung statt an seiner Aussage.
 */
export async function registriereQuelle(
  pool: Pool,
  key: string,
  kind: "automatic" | "manual" = "automatic",
  active = true,
): Promise<void> {
  await pool.query(
    "INSERT INTO source_system (key, label, kind, active) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET kind = EXCLUDED.kind, active = EXCLUDED.active",
    [key, key.toUpperCase(), kind, active],
  );
}
