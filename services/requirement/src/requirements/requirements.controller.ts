import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
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
import { CreateRequirementDto } from "./create-requirement.dto";
import { ListRequirementsQuery } from "./list-requirements.query";
import { RequirementResponse } from "./requirement.dto";
import { RequirementVersionResponse } from "./requirement-version.dto";
import { RequirementsService } from "./requirements.service";

@ApiTags("Anforderungen")
@ApiBearerAuth()
@ApiResponse({ status: 401, description: "Kein oder ungueltiges Token" })
@Controller("requirements")
export class RequirementsController {
  constructor(private readonly service: RequirementsService) {}

  @Get()
  @ApiOperation({
    summary: "Anforderungen auflisten",
    description: "Ohne asOf der aktuelle Bestand, mit asOf der Zustand zum Stichtag (§19.4).",
  })
  @ApiQuery({
    name: "asOf",
    required: false,
    schema: { type: "string", format: "date-time" },
    example: "2026-03-15T10:00:00.000Z",
    description:
      "Stichtag. Ohne Angabe der aktuelle Bestand, mit Angabe der Zustand, den das " +
      "System zu diesem Zeitpunkt kannte (§19.4).",
  })
  @ApiResponse({ status: 200, type: [RequirementResponse], description: "Bestand" })
  @ApiResponse({ status: 400, description: "Unlesbarer Stichtag" })
  findAll(@Query() abfrage: ListRequirementsQuery): Promise<RequirementResponse[]> {
    return this.service.findAll(abfrage.asOf);
  }

  @Get(":id/versions")
  @ApiOperation({
    summary: "Versionshistorie einer Anforderung",
    description:
      "Alle Versionen, aelteste zuerst. Aus dem Vergleich aufeinanderfolgender Versionen " +
      "ergeben sich alter Wert, neuer Wert und feldgenaue Herkunft (§16).",
  })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiResponse({ status: 200, type: [RequirementVersionResponse], description: "Alle Versionen" })
  @ApiResponse({ status: 400, description: "Unlesbare Kennung" })
  findVersions(@Param("id", ParseUUIDPipe) id: string): Promise<RequirementVersionResponse[]> {
    return this.service.findVersions(id);
  }

  @Post()
  @ApiOperation({ summary: "Anforderung anlegen" })
  @ApiResponse({ status: 201, type: RequirementResponse, description: "Angelegte Anforderung" })
  @ApiResponse({ status: 400, description: "Rumpf unvollstaendig oder unbekannte Felder" })
  @ApiResponse({
    status: 409,
    description: "sourceSystem und externalId existieren bereits (Idempotenz nach §19.1)",
  })
  create(
    @Body() eingabe: CreateRequirementDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.service.create(eingabe, benutzer);
  }
}
