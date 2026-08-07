/**
 * Erkennt eine Verletzung einer benannten Eindeutigkeit.
 *
 * Drizzle verpackt Treiberfehler in DrizzleQueryError; die PostgreSQL-Angaben liegen
 * unter `.cause`. Die Kette wird durchlaufen, damit die Erkennung auch dann traegt, wenn
 * sich die Verpackungstiefe mit einer neuen Drizzle-Fassung aendert.
 */
export function istEindeutigkeitsverletzung(fehler: unknown, constraint: string): boolean {
  let aktuell: unknown = fehler;

  for (let tiefe = 0; tiefe < 5; tiefe += 1) {
    if (typeof aktuell !== "object" || aktuell === null) {
      return false;
    }

    const kandidat = aktuell as { code?: unknown; constraint?: unknown; cause?: unknown };

    if (kandidat.code === "23505" && kandidat.constraint === constraint) {
      return true;
    }

    aktuell = kandidat.cause;
  }

  return false;
}
