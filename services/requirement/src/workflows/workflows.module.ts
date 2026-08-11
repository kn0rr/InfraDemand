import { Module } from "@nestjs/common";
import { WorkflowsController } from "./workflows.controller";
import { WorkflowsRepository } from "./workflows.repository";
import { WorkflowsService } from "./workflows.service";

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowsRepository],
  // Export, weil M4.2 den Statuswechsel im Requirements-Modul gegen den geltenden
  // Workflow prueft.
  exports: [WorkflowsService, WorkflowsRepository],
})
export class WorkflowsModule {}
