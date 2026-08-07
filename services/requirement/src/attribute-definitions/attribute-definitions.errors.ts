/** Schluessel ist fuer diesen Anforderungstyp bereits definiert (§6). */
import type { AttributFehler } from "./attribut-pruefung";

/** Dynamische Attribute genuegen den geltenden Definitionen nicht (§6). */
export class DynamicAttributeValidationError extends Error {
  constructor(readonly fehler: AttributFehler[]) {
    super(fehler.map((eintrag) => eintrag.message).join("; "));
    this.name = "DynamicAttributeValidationError";
  }
}

export class DuplicateAttributeKeyError extends Error {
  constructor(
    readonly key: string,
    readonly requirementType: string | null,
  ) {
    super(
      requirementType === null
        ? `Attribut "${key}" ist bereits allgemein definiert`
        : `Attribut "${key}" ist fuer "${requirementType}" bereits definiert`,
    );
    this.name = "DuplicateAttributeKeyError";
  }
}

export class AttributeDefinitionNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Attributdefinition ${id} existiert nicht`);
    this.name = "AttributeDefinitionNotFoundError";
  }
}
