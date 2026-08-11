import type { Graphfehler } from "./graph-pruefung";

/** Es gibt bereits einen Workflow fuer diesen Anforderungstyp (§7). */
export class DuplicateWorkflowRequirementTypeError extends Error {
  constructor(readonly requirementType: string | null) {
    super(
      requirementType === null
        ? "Es gibt bereits einen allgemeinen Workflow"
        : `Fuer "${requirementType}" gibt es bereits einen Workflow`,
    );
    this.name = "DuplicateWorkflowRequirementTypeError";
  }
}

export class WorkflowDefinitionNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`Workflow-Definition ${id} existiert nicht`);
    this.name = "WorkflowDefinitionNotFoundError";
  }
}
