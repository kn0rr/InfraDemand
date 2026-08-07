import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { pruefeDynamischeAttribute } from "../attribute-definitions/attribut-pruefung";
import { DynamicAttributeValidationError } from "../attribute-definitions/attribute-definitions.errors";
import { AttributeDefinitionsService } from "../attribute-definitions/attribute-definitions.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { RequirementHistoryRow, RequirementRow } from "../database/schema";
import { UnknownSourceSystemError } from "../source-systems/source-systems.errors";
import { SourceSystemsService } from "../source-systems/source-systems.service";
import type { CreateRequirementDto } from "./create-requirement.dto";
import type { RequirementResponse } from "./requirement.dto";
import type { RequirementVersionResponse } from "./requirement-version.dto";
import { DuplicateExternalIdError } from "./requirements.errors";
import { RequirementsRepository } from "./requirements.repository";

@Injectable()
export class RequirementsService {
  constructor(
    private readonly repository: RequirementsRepository,
    private readonly sourceSystems: SourceSystemsService,
    private readonly attributeDefinitions: AttributeDefinitionsService,
  ) {}

  /**
   * Ohne Stichtag der aktuelle Bestand aus der Fachtabelle, mit Stichtag der Zustand aus
   * der Historie. Beide Wege muessen fuer "jetzt" dasselbe Ergebnis liefern - das prueft
   * der Test "Stichtag jetzt entspricht dem aktuellen Bestand".
   */
  async findAll(stichtag?: string): Promise<RequirementResponse[]> {
    const zeilen =
      stichtag === undefined
        ? await this.repository.findAll()
        : await this.repository.findAsOf(new Date(stichtag));

    return zeilen.map(RequirementsService.toResponse);
  }

  async findVersions(id: string): Promise<RequirementVersionResponse[]> {
    const versionen = await this.repository.findVersions(id);
    return versionen.map(RequirementsService.toVersionResponse);
  }

  async create(
    eingabe: CreateRequirementDto,
    benutzer: AuthenticatedUser,
  ): Promise<RequirementResponse> {
    const herkunft = eingabe.sourceSystem ?? "infrademand";

    try {
      // ADR-0017 A4: Wessen Klasse unbekannt ist, darf nicht schreiben.
      await this.sourceSystems.pruefeSchreibquelle(herkunft);

      // §6: gegen die **aktuell** gueltigen Definitionen, nicht gegen die bei Anlage
      // des Datensatzes geltenden. §19.2: derselbe Pruefpfad fuer jeden Eingangsweg.
      const definitionen = await this.attributeDefinitions.geltendeDefinitionen(
        eingabe.requirementType,
      );
      const pruefung = pruefeDynamischeAttribute(eingabe.dynamicAttributes ?? {}, definitionen);

      if (pruefung.fehler.length > 0) {
        throw new DynamicAttributeValidationError(pruefung.fehler);
      }

      const zeile = await this.repository.create({
        projectId: eingabe.projectId,
        requirementType: eingabe.requirementType,
        status: eingabe.status,
        owner: eingabe.owner,
        sourceSystem: herkunft,
        externalId: eingabe.externalId ?? null,
        // Die geprueften Werte, nicht die eingereichten: Vorgabewerte sind ergaenzt,
        // leere optionale Attribute entfernt.
        dynamicAttributes: pruefung.werte,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return RequirementsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof DynamicAttributeValidationError) {
        throw new BadRequestException({
          statusCode: 400,
          error: "Bad Request",
          message: "Dynamische Attribute genuegen den geltenden Definitionen nicht",
          // Feldbezogen, damit ein Formular alle beanstandeten Felder auf einmal
          // anzeigen kann statt eines nach dem anderen.
          attributes: fehler.fehler,
        });
      }
      if (fehler instanceof UnknownSourceSystemError) {
        throw new BadRequestException(fehler.message);
      }
      if (fehler instanceof DuplicateExternalIdError) {
        throw new ConflictException(fehler.message);
      }
      throw fehler;
    }
  }

  private static toResponse(row: RequirementRow): RequirementResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      requirementType: row.requirementType,
      status: row.status,
      owner: row.owner,
      sourceSystem: row.sourceSystem,
      externalId: row.externalId,
      dynamicAttributes: row.dynamicAttributes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(row: RequirementHistoryRow): RequirementVersionResponse {
    return {
      ...RequirementsService.toResponse(row),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }
}
