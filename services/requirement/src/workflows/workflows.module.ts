import { Module } from "@nestjs/common";
import { AttributeDefinitionsModule } from "../attribute-definitions/attribute-definitions.module";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  // Fuer die Feldnamenpruefung beim Speichern (ADR-0024 Punkt 8): Ob ein in einer
  // Bedingung genanntes Feld existiert, steht in den Attributdefinitionen.
  imports: [AttributeDefinitionsModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowsRepository],
  // Export, weil M4.2 den Statuswechsel im Requirements-Modul gegen den geltenden
  // Workflow prueft.
  exports: [WorkflowsService, WorkflowsRepository],
})
export class WorkflowsModule {}
