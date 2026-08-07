/**
 * Die Quelle einer Schreiboperation ist nicht eingetragen oder darf nicht mehr schreiben
 * (ADR-0017 A4).
 *
 * Fachlicher Fehler, keine HTTP-Ausnahme: Die Registratur kennt keine Transportschicht
 * (§2). Die Uebersetzung nach aussen macht der aufrufende Service.
 */
export class UnknownSourceSystemError extends Error {
  constructor(
    readonly key: string,
    readonly grund: "unbekannt" | "ausser Betrieb",
  ) {
    super(`Herkunftssystem "${key}" ist ${grund}`);
    this.name = "UnknownSourceSystemError";
  }
}
