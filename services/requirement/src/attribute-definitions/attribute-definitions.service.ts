import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { AttributeDefinitionHistoryRow, AttributeDefinitionRow } from "../database/schema";
import type { GeltendeDefinition } from "./attribut-pruefung";
import {
  type AttributeDefinitionResponse,
  type AttributeDefinitionVersionResponse,
} from "./attribute-definition.dto";
import {
  AttributeDefinitionNotFoundError,
  DuplicateAttributeKeyError,
} from "./attribute-definitions.errors";
import { AttributeDefinitionsRepository } from "./attribute-definitions.repository";
import type { CreateAttributeDefinitionDto } from "./create-attribute-definition.dto";
import type { UpdateAttributeDefinitionDto } from "./update-attribute-definition.dto";

/** Typen, die eine Werteliste tragen muessen - und nur sie. */
const TYPEN_MIT_WERTELISTE = new Set(["enum", "multi_enum"]);

@Injectable()
export class AttributeDefinitionsService {
  constructor(private readonly repository: AttributeDefinitionsRepository) {}

  async findAll(requirementType?: string): Promise<AttributeDefinitionResponse[]> {
    const zeilen =
      requirementType === undefined
        ? await this.repository.findAll()
        : await this.repository.findForRequirementType(requirementType);

    return zeilen.map(AttributeDefinitionsService.toResponse);
  }

  /**
   * Die fuer einen Anforderungstyp geltenden Definitionen, zugeschnitten auf das, was
   * die Pruefung braucht. Die Zuordnung ist ausgeschrieben und nicht durchgereicht -
   * dadurch verlaesst keine Datenbankzeile den Bereich.
   */
  async geltendeDefinitionen(requirementType: string): Promise<GeltendeDefinition[]> {
    const zeilen = await this.repository.findForRequirementType(requirementType);

    return zeilen.map((zeile) => ({
      key: zeile.key,
      label: zeile.label,
      dataType: zeile.dataType,
      required: zeile.required,
      defaultValue: zeile.defaultValue,
      allowedValues: zeile.allowedValues,
    }));
  }

  async findVersions(id: string): Promise<AttributeDefinitionVersionResponse[]> {
    const versionen = await this.repository.findVersions(id);

    if (versionen.length === 0) {
      throw new NotFoundException(`Attributdefinition ${id} existiert nicht`);
    }

    return versionen.map(AttributeDefinitionsService.toVersionResponse);
  }

  async create(
    eingabe: CreateAttributeDefinitionDto,
    benutzer: AuthenticatedUser,
  ): Promise<AttributeDefinitionResponse> {
    AttributeDefinitionsService.pruefeWerteliste(eingabe.dataType, eingabe.allowedValues);

    try {
      const zeile = await this.repository.create({
        key: eingabe.key,
        requirementType: eingabe.requirementType ?? null,
        label: eingabe.label,
        dataType: eingabe.dataType,
        required: eingabe.required ?? false,
        defaultValue: eingabe.defaultValue ?? null,
        allowedValues: eingabe.allowedValues ?? null,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return AttributeDefinitionsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof DuplicateAttributeKeyError) {
        throw new ConflictException(fehler.message);
      }
      throw fehler;
    }
  }

  async update(
    id: string,
    eingabe: UpdateAttributeDefinitionDto,
    benutzer: AuthenticatedUser,
  ): Promise<AttributeDefinitionResponse> {
    AttributeDefinitionsService.pruefeWerteliste(eingabe.dataType, eingabe.allowedValues);

    try {
      const zeile = await this.repository.update(id, {
        label: eingabe.label,
        dataType: eingabe.dataType,
        required: eingabe.required,
        defaultValue: eingabe.defaultValue ?? null,
        allowedValues: eingabe.allowedValues ?? null,
        active: eingabe.active,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return AttributeDefinitionsService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof AttributeDefinitionNotFoundError) {
        throw new NotFoundException(fehler.message);
      }
      throw fehler;
    }
  }

  /**
   * Eine Werteliste ohne Aufzaehlungstyp waere wirkungslos, ein Aufzaehlungstyp ohne
   * Werteliste unpruefbar. Beides faellt hier auf, nicht erst in M3.3 beim ersten
   * Schreibversuch gegen die Definition.
   */
  private static pruefeWerteliste(dataType: string, allowedValues: string[] | undefined): void {
    const brauchtListe = TYPEN_MIT_WERTELISTE.has(dataType);

    if (brauchtListe && allowedValues === undefined) {
      throw new BadRequestException(`dataType "${dataType}" verlangt allowedValues`);
    }

    if (!brauchtListe && allowedValues !== undefined) {
      throw new BadRequestException(`dataType "${dataType}" erlaubt kein allowedValues`);
    }
  }

  private static toResponse(row: AttributeDefinitionRow): AttributeDefinitionResponse {
    return {
      id: row.id,
      key: row.key,
      requirementType: row.requirementType,
      label: row.label,
      dataType: row.dataType,
      required: row.required,
      defaultValue: row.defaultValue,
      allowedValues: row.allowedValues,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(
    row: AttributeDefinitionHistoryRow,
  ): AttributeDefinitionVersionResponse {
    return {
      ...AttributeDefinitionsService.toResponse(row),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }
}
