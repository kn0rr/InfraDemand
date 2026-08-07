import type { Pool } from "pg";

export interface Verstoss {
  pruefung: string;
  id: string;
}

/** Nur Bezeichner - die Tabellennamen kommen aus dem Test, nicht aus Eingaben. */
const BEZEICHNER = /^[a-z_]+$/;

/**
 * Prueft die zeitliche Zusicherung aus ADR-0012 fuer eine Fach- und Historientabelle.
 *
 * Diese Zusicherung ist der Grund, aus dem der versionierte Schreibpfad **nicht** in eine
 * generische Hilfsfunktion gezogen wurde: Ein Fehler darin scheitert nicht laut, sondern
 * liefert bei Stichtagsabfragen stillschweigend andere Ergebnisse. Statt den Schreibvorgang
 * zu verstecken, wird hier die Wirkung geprueft - fuer jede Entitaet gleich.
 */
export async function pruefeVersionshistorie(
  pool: Pool,
  fachtabelle: string,
  historientabelle: string,
): Promise<Verstoss[]> {
  if (!BEZEICHNER.test(fachtabelle) || !BEZEICHNER.test(historientabelle)) {
    throw new Error("Unzulaessiger Tabellenname");
  }

  const pruefungen: { name: string; sql: string }[] = [
    {
      name: "genau eine offene Version je Datensatz",
      sql: `SELECT id::text FROM ${historientabelle} GROUP BY id
            HAVING count(*) FILTER (WHERE valid_to IS NULL) <> 1`,
    },
    {
      name: "Versionen sind fortlaufend ab 1",
      sql: `SELECT id::text FROM ${historientabelle} GROUP BY id
            HAVING min(version) <> 1
                OR max(version) <> count(*)
                OR count(DISTINCT version) <> count(*)`,
    },
    {
      name: "Zeitraeume stossen lueckenlos aneinander",
      sql: `SELECT id::text FROM (
              SELECT id, valid_to,
                     lead(valid_from) OVER (PARTITION BY id ORDER BY version) AS folgt
              FROM ${historientabelle}
            ) t
            WHERE folgt IS NOT NULL AND (valid_to IS NULL OR valid_to <> folgt)`,
    },
    {
      name: "Fachtabelle traegt die hoechste Versionsnummer",
      sql: `SELECT f.id::text FROM ${fachtabelle} f
            JOIN (SELECT id, max(version) AS hoechste FROM ${historientabelle} GROUP BY id) h
              ON h.id = f.id
            WHERE f.version <> h.hoechste`,
    },
  ];

  const verstoesse: Verstoss[] = [];

  for (const pruefung of pruefungen) {
    const { rows } = await pool.query<{ id: string }>(pruefung.sql);
    for (const zeile of rows) {
      verstoesse.push({ pruefung: pruefung.name, id: zeile.id });
    }
  }

  return verstoesse;
}
