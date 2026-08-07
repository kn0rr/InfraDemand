import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Rollen } from "../auth/rollen.decorator";
import {
  CreateMastershipRuleDto,
  MastershipRuleResponse,
  MastershipRuleVersionResponse,
  UpdateMastershipRuleDto,
} from "./mastership.dto";
import { MastershipService } from "./mastership.service";

@ApiTags("Datenhoheit")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Kein oder ungueltiges Token" })
@Controller("mastership-rules")
export class MastershipController {
  constructor(private readonly service: MastershipService) {}

  @Get()
  @ApiOperation({
    summary: "Hoheitsregeln auflisten",
    description:
      "Welche Quellenklasse fuer ein Feld den Vorrang hat (§19.3). Lesen ist nicht auf " +
      "platform-admin beschraenkt - die Oberflaeche zeigt anhand der Regel, welche " +
      "Felder von Hand pflegbar sind.",
  })
  @ApiResponse({ status: 200, type: [MastershipRuleResponse] })
  findAll(): Promise<MastershipRuleResponse[]> {
    return this.service.findAll();
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "Versionen einer Hoheitsregel" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: [MastershipRuleVersionResponse] })
  @ApiResponse({ status: 404, description: "Regel existiert nicht" })
  findVersions(@Param("id", ParseUUIDPipe) id: string): Promise<MastershipRuleVersionResponse[]> {
    return this.service.findVersions(id);
  }

  @Post()
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Hoheitsregel anlegen",
    description: "Entscheidet, wessen Schreibvorgang gewinnt, und verlangt platform-admin.",
  })
  @ApiResponse({ status: 201, type: MastershipRuleResponse })
  @ApiResponse({ status: 400, description: "Feld ist weder Kernfeld noch definiertes Attribut" })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 409, description: "Fuer dieses Feld besteht bereits eine Regel" })
  create(
    @Body() eingabe: CreateMastershipRuleDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<MastershipRuleResponse> {
    return this.service.create(eingabe, benutzer);
  }

  @Put(":id")
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Hoheitsregel aendern",
    description: "Erzeugt eine neue Version (ADR-0012). `field` ist unveraenderlich.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: MastershipRuleResponse })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 404, description: "Regel existiert nicht" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() eingabe: UpdateMastershipRuleDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<MastershipRuleResponse> {
    return this.service.update(id, eingabe, benutzer);
  }
}
