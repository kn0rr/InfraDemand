/**
 * Verletzung der Idempotenz aus §19.1. Bewusst ein fachlicher Fehler und keine
 * HTTP-Ausnahme: Das Repository kennt keine Transportschicht (§2).
 */
export class DuplicateExternalIdError extends Error {
  constructor(
    readonly sourceSystem: string,
    readonly externalId: string,
  ) {
    super(`Datensatz ${externalId} aus ${sourceSystem} existiert bereits`);
    this.name = "DuplicateExternalIdError";
  }
}
/** Kein Datensatz unter dieser Herkunft und diesem fremden Bezeichner. */
export class RequirementNotFoundError extends Error {
  constructor(
    readonly sourceSystem: string,
    readonly externalId: string,
  ) {
    super(`Kein Datensatz ${externalId} aus ${sourceSystem}`);
    this.name = "RequirementNotFoundError";
  }
}
