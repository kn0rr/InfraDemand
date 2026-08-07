/** Fuer dieses Feld und diesen Geltungsbereich gibt es bereits eine Regel (ADR-0017 A6). */
export class DuplicateMastershipRuleError extends Error {
  constructor(readonly field: string) {
    super(`Fuer das Feld "${field}" besteht bereits eine Regel`);
    this.name = "DuplicateMastershipRuleError";
  }
}

export class MastershipRuleNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Hoheitsregel ${id} existiert nicht`);
    this.name = "MastershipRuleNotFoundError";
  }
}

/** Das benannte Feld gibt es weder als Kernfeld noch als Attributdefinition. */
export class UnknownFieldError extends Error {
  constructor(readonly field: string) {
    super(`"${field}" ist weder ein Kernfeld noch ein definiertes Attribut`);
    this.name = "UnknownFieldError";
  }
}
