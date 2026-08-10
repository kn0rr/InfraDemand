import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
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
import { CreateRequirementDto } from "./create-requirement.dto";
import { SetzeFesthaltungDto } from "./festhaltung.dto";
import { ListRequirementsQuery } from "./list-requirements.query";
import { PatchRequirementDto } from "./patch-requirement.dto";
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
  @ApiResponse({
    status: 400,
    description:
      "Rumpf unvollstaendig, unbekannte Felder, sourceSystem nicht in der Registratur " +
      "(ADR-0017 A4), oder dynamische Attribute genuegen den geltenden Definitionen " +
      "nicht (§6). Im letzten Fall traegt die Antwort zusaetzlich ein Feld `attributes` " +
      "mit je einem Eintrag aus `key` und `message` fuer jedes beanstandete Attribut.",
  })
  @ApiResponse({
    status: 409,
    description:
      "Zwei Ursachen. Entweder sind sourceSystem und externalId bereits vergeben " +
      "(Idempotenz nach §19.1), oder fuer mindestens ein Feld ist eine andere Quelle " +
      "massgeblich (§19.3). Im zweiten Fall traegt die Antwort ein Feld `fields` mit je " +
      "einem Eintrag aus `field`, `reason` und `message`; im ersten fehlt es. Gespeichert " +
      "wird in beiden Faellen nichts.",
  })
  create(
    @Body() eingabe: CreateRequirementDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.service.create(eingabe, benutzer);
  }

  @Patch("by-source/:sourceSystem/:externalId")
  @ApiOperation({
    summary: "Anforderung ueber den fremden Bezeichner aendern",
    description:
      "Adressiert ueber Herkunftssystem und dortigen Bezeichner - interne Kennungen " +
      "werden ueber die Servicegrenze nicht gereicht (ADR-0010). Teilweise Aenderung: " +
      "ein nicht genanntes Feld bleibt unveraendert. Legt nicht an; dafuer POST.",
  })
  @ApiParam({ name: "sourceSystem", example: "sap" })
  @ApiParam({ name: "externalId", example: "A-4711" })
  @ApiResponse({ status: 200, type: RequirementResponse, description: "Geaenderte Anforderung" })
  @ApiResponse({
    status: 400,
    description: "Rumpf unzulaessig oder dynamische Attribute ungueltig",
  })
  @ApiResponse({ status: 404, description: "Kein Datensatz unter dieser Herkunft" })
  @ApiResponse({
    status: 409,
    description:
      "Fuer mindestens ein Feld ist eine andere Quelle massgeblich (§19.3). Die Antwort " +
      "traegt ein Feld `fields` mit je einem Eintrag aus `field`, `reason` und `message`. " +
      "Es wird nichts gespeichert - auch nicht die zulaessigen Felder (ADR-0019 Punkt 1).",
  })
  patchBySource(
    @Param("sourceSystem") sourceSystem: string,
    @Param("externalId") externalId: string,
    @Body() eingabe: PatchRequirementDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.service.patchBySource(sourceSystem, externalId, eingabe, benutzer);
  }
  @Put("by-source/:sourceSystem/:externalId/holds/:field")
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Feld gegen automatische Uebernahme festhalten",
    description:
      "Ab dann aendert kein automatischer Ladevorgang dieses Feld an diesem Datensatz " +
      "(§19.3). Die uebrigen Felder bleiben unberuehrt, und ein Import scheitert nicht - " +
      "er uebernimmt sie und die Abweisung wird verzeichnet.",
  })
  @ApiParam({ name: "sourceSystem", example: "sap" })
  @ApiParam({ name: "externalId", example: "A-4711" })
  @ApiParam({ name: "field", example: "owner" })
  @ApiResponse({ status: 200, type: RequirementResponse })
  @ApiResponse({ status: 400, description: "Feld ist weder Kernfeld noch definiertes Attribut" })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 404, description: "Kein Datensatz unter dieser Herkunft" })
  setzeFesthaltung(
    @Param("sourceSystem") sourceSystem: string,
    @Param("externalId") externalId: string,
    @Param("field") field: string,
    @Body() eingabe: SetzeFesthaltungDto,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.service.setzeFesthaltung(sourceSystem, externalId, field, eingabe.reason, benutzer);
  }

  @Delete("by-source/:sourceSystem/:externalId/holds/:field")
  @Rollen("platform-admin")
  @ApiOperation({
    summary: "Festhaltung aufheben",
    description: "Eigener, ausdruecklicher Vorgang - keine Nebenwirkung einer Aenderung.",
  })
  @ApiParam({ name: "sourceSystem", example: "sap" })
  @ApiParam({ name: "externalId", example: "A-4711" })
  @ApiParam({ name: "field", example: "owner" })
  @ApiResponse({ status: 200, type: RequirementResponse })
  @ApiResponse({ status: 403, description: "Rolle platform-admin fehlt" })
  @ApiResponse({ status: 404, description: "Datensatz oder Festhaltung existiert nicht" })
  hebeFesthaltungAuf(
    @Param("sourceSystem") sourceSystem: string,
    @Param("externalId") externalId: string,
    @Param("field") field: string,
    @CurrentUser() benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    return this.service.hebeFesthaltungAuf(sourceSystem, externalId, field, benutzer);
  }
}
