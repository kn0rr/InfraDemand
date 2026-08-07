import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { Rollen } from "../auth/rollen.decorator";
import {
  AttributeDefinitionResponse,
  AttributeDefinitionVersionResponse,
} from "./attribute-definition.dto";
import { AttributeDefinitionsService } from "./attribute-definitions.service";
import { CreateAttributeDefinitionDto } from "./create-attribute-definition.dto";
import { UpdateAttributeDefinitionDto } from "./update-attribute-definition.dto";

@ApiTags("Attributdefinitionen")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Kein oder ungueltiges Token" })
@Controller("attribute-definitions")
export class AttributeDefinitionsController {
  constructor(private readonly service: AttributeDefinitionsService) {}

  @Get()
  @ApiOperation({
    summary: "Attributdefinitionen auflisten",
    description:
      "Ohne requirementType alle Definitionen einschliesslich ausser Kraft gesetzter. " +
      "Mit requirementType die fuer diesen Typ geltenden aktiven - typbezogene und " +
      "allgemeine zusammen. Lesen ist nicht auf platform-admin beschraenkt: Das Frontend " +
      "braucht die Definitionen, um Formulare aufzubauen (§6).",
  })
  @ApiQuery({ name: "requirementType", required: false, schema: { type: "string" } })
  @ApiResponse({ status: 200, type: [AttributeDefinitionResponse] })
  findAll(
    @Query("requirementType") requirementType?: string,
  ): Promise<AttributeDefinitionResponse[]> {
    return this.service.findAll(requirementType);
  }

  @Get(":id/versions")
  @ApiOperation({
    summary: "Versionen einer Attributdefinition",
    description: "Vollstaendige Historie nach §19.4.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: [AttributeDefinitionVersionResponse] })
  @ApiResponse({ status: 404, description: "Definition existiert nicht" })
  findVersions(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AttributeDefinitionVersionResponse[]> {
    return this.service.findVersions(id);
  }

  @Post()
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Attributdefinition anlegen",
    description: "Aendert das gueltige Datenmodell und verlangt daher platform-admin.",
  })
  @ApiResponse({ status: 201, type: AttributeDefinitionResponse })
  @ApiResponse({ status: 400, description: "Rumpf unvollstaendig oder Werteliste unpassend" })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({
    status: 409,
    description: "Schluessel fuer diesen Anforderungstyp bereits vergeben",
  })
  create(
    @Body() eingabe: CreateAttributeDefinitionDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<AttributeDefinitionResponse> {
    return this.service.create(eingabe, benutzer);
  }

  @Put(":id")
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Attributdefinition aendern",
    description:
      "Erzeugt eine neue Version (ADR-0012). key und requirementType sind unveraenderlich - " +
      "sie bezeichnen die Definition.",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, type: AttributeDefinitionResponse })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 404, description: "Definition existiert nicht" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() eingabe: UpdateAttributeDefinitionDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<AttributeDefinitionResponse> {
    return this.service.update(id, eingabe, benutzer);
  }
}
