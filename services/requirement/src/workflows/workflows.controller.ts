import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Rollen } from "../auth/rollen.decorator";
import { CreateWorkflowDefinitionDto } from "./create-workflow-definition.dto";
import { UpdateWorkflowDefinitionDto } from "./update-workflow-definition.dto";
import {
  WorkflowDefinitionResponse,
  WorkflowDefinitionVersionResponse,
} from "./workflow-definition.dto";
import { WorkflowsService } from "./workflows.service";

@ApiTags("Workflow-Definitionen")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Kein oder ungueltiges Token" })
@Controller("workflow-definitions")
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Get()
  @ApiOperation({
    summary: "Workflow-Definitionen auflisten",
    description:
      "Einschliesslich ausser Kraft gesetzter. Lesen ist nicht auf platform-admin " +
      "beschraenkt: Die Oberflaeche braucht den Graphen, um zulaessige Uebergaenge als " +
      "Schaltflaechen anzubieten statt eines freien Statusfeldes (§7, M4.5).",
  })
  @ApiResponse({ status: 200, type: [WorkflowDefinitionResponse] })
  findAll(): Promise<WorkflowDefinitionResponse[]> {
    return this.service.findAll();
  }

  @Get(":id/versions")
  @ApiOperation({
    summary: "Versionen einer Workflow-Definition",
    description:
      "Vollstaendige Historie nach §19.4. Zugleich der Lesepfad fuer §7: Eine laufende " +
      "Anforderung bleibt auf ihrer Ursprungsfassung, und die steht hier.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: [WorkflowDefinitionVersionResponse] })
  @ApiResponse({ status: 404, description: "Definition existiert nicht" })
  findVersions(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<WorkflowDefinitionVersionResponse[]> {
    return this.service.findVersions(id);
  }

  @Post()
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Workflow-Definition anlegen",
    description: "Legt den gueltigen Ablauf fest und verlangt daher platform-admin.",
  })
  @ApiResponse({ status: 201, type: WorkflowDefinitionResponse })
  @ApiResponse({ status: 400, description: "Rumpf unvollstaendig oder Graph widerspruechlich" })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 409, description: "Fuer diesen Anforderungstyp gibt es bereits einen" })
  create(
    @Body() eingabe: CreateWorkflowDefinitionDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponse> {
    return this.service.create(eingabe, benutzer);
  }

  @Put(":id")
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Workflow-Definition aendern",
    description:
      "Erzeugt eine neue Version (ADR-0012). requirementType ist unveraenderlich - er " +
      "bezeichnet, wofuer der Workflow gilt.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: WorkflowDefinitionResponse })
  @ApiResponse({ status: 400, description: "Rumpf unvollstaendig oder Graph widerspruechlich" })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 404, description: "Definition existiert nicht" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() eingabe: UpdateWorkflowDefinitionDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<WorkflowDefinitionResponse> {
    return this.service.update(id, eingabe, benutzer);
  }
}
