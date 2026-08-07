import { SetMetadata } from "@nestjs/common";

export const ROLLEN_SCHLUESSEL = "rollen";

/**
 * Verlangt mindestens eine der angegebenen Realm-Rollen.
 *
 * Grobe Pruefung als Zwischenstand: §8 verlangt Objekt- und Feldebene, die mit der
 * Policy-Engine in M5 entsteht ([ADR-0004](../../../../docs/adr/0004-authentifizierung-und-autorisierung.md)).
 * Bis dahin ist "gar keine Pruefung" die falsche Naeherung - wer Attributdefinitionen
 * aendert, schreibt das Datenmodell um.
 */
export const Rollen = (...rollen: string[]) => SetMetadata(ROLLEN_SCHLUESSEL, rollen);
