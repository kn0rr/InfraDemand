/**
 * Auswertung der Ansprueche aus dem Zugriffstoken.
 *
 * Ohne Framework und ohne Entschluesselung: Das Zerlegen des Tokens gehoert an den Rand
 * (die Rueckrufroute), die Deutung seines Inhalts ist eine reine Abbildung - und nur so
 * ist sie pruefbar.
 *
 * **Nichts hiervon ist eine Berechtigungspruefung.** Durchgesetzt wird im jeweiligen
 * Service gegen das Token; der BFF ist kein Berechtigungspunkt (§8, ADR-0014).
 */
export interface Tokeninhalt {
  realm_access?: { roles?: unknown };
  tenants?: unknown;
}

/** Verwirft alles, was keine Zeichenkette ist - ein Anspruch ist unbeaufsichtigte Eingabe. */
function textliste(kandidat: unknown): string[] {
  return Array.isArray(kandidat) ? kandidat.filter((eintrag) => typeof eintrag === "string") : [];
}

export function realmRollen(inhalt: Tokeninhalt): string[] {
  return textliste(inhalt.realm_access?.roles);
}

/**
 * Mandantenzugehoerigkeiten (ADR-0026 Punkt 6).
 *
 * Anspruch der obersten Ebene, **nicht** unter `realm_access` - so liest ihn auch
 * `jwt.strategy.ts` im Requirement Service. Die Verwechslung ist folgenschwer und
 * meldet sich nicht: Ein falsch verorteter Anspruch ergibt eine leere Liste, und eine
 * leere Liste bedeutet „gehoert keinem Mandanten an".
 */
export function mandanten(inhalt: Tokeninhalt): string[] {
  return textliste(inhalt.tenants);
}
