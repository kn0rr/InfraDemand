import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AttributeDefinitionsRepository } from "../attribute-definitions/attribute-definitions.repository";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import type { MastershipRuleHistoryRow, MastershipRuleRow } from "../database/schema";
import { spezifischsteJe } from "../gemeinsam/spezifitaet";
import type {
  CreateMastershipRuleDto,
  MastershipRuleResponse,
  MastershipRuleVersionResponse,
  UpdateMastershipRuleDto,
} from "./mastership.dto";
import { REGELBARE_KERNFELDER } from "./mastership.dto";
import {
  DuplicateMastershipRuleError,
  MastershipRuleNotFoundError,
  UnknownFieldError,
} from "./mastership.errors";
import { MastershipRepository } from "./mastership.repository";

@Injectable()
export class MastershipService {
  constructor(
    private readonly repository: MastershipRepository,
    private readonly attributeDefinitions: AttributeDefinitionsRepository,
  ) {}

  async findAll(): Promise<MastershipRuleResponse[]> {
    const zeilen = await this.repository.findAll();
    return zeilen.map(MastershipService.toResponse);
  }

  async findVersions(id: string): Promise<MastershipRuleVersionResponse[]> {
    const versionen = await this.repository.findVersions(id);

    if (versionen.length === 0) {
      throw new NotFoundException(new MastershipRuleNotFoundError(id).message);
    }

    return versionen.map(MastershipService.toVersionResponse);
  }

  async create(
    eingabe: CreateMastershipRuleDto,
    benutzer: AuthenticatedUser,
  ): Promise<MastershipRuleResponse> {
    await this.pruefeFeld(eingabe.field);
    // Wie bei den Attributdefinitionen (ADR-0026 Punkt 3): Die Auswahl kommt vom Aufrufer,
    // aber er kann nur einen der eigenen Mandanten waehlen.
    if (eingabe.tenant !== undefined && !benutzer.tenants.includes(eingabe.tenant)) {
      throw new ForbiddenException(`Sie gehoeren dem Mandanten "${eingabe.tenant}" nicht an`);
    }

    try {
      const zeile = await this.repository.create({
        field: eingabe.field,
        mode: eingabe.mode,
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
        tenant: eingabe.tenant ?? null,
      });

      return MastershipService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof DuplicateMastershipRuleError) {
        throw new ConflictException(fehler.message);
      }
      throw fehler;
    }
  }

  async update(
    id: string,
    eingabe: UpdateMastershipRuleDto,
    benutzer: AuthenticatedUser,
  ): Promise<MastershipRuleResponse> {
    try {
      const zeile = await this.repository.updateMode(id, eingabe.mode, {
        changedBy: benutzer.userId,
        changeSource: benutzer.clientId,
      });

      return MastershipService.toResponse(zeile);
    } catch (fehler) {
      if (fehler instanceof MastershipRuleNotFoundError) {
        throw new NotFoundException(fehler.message);
      }
      throw fehler;
    }
  }

  /**
   * Eine Regel fuer ein Feld, das es nicht gibt, greift nie - sie sieht aber aus, als
   * taete sie es. Das ist der wahrscheinlichste Fehler beim Pflegen und faellt sonst
   * nirgends auf.
   *
   * Geprueft wird gegen die Kernfelder und gegen **alle** Attributdefinitionen, ueber
   * Anforderungstypen hinweg: Eine Regel gilt global (ADR-0017 A5), also genuegt es,
   * wenn das Attribut fuer irgendeinen Typ definiert ist.
   */
  private async pruefeFeld(field: string): Promise<void> {
    if ((REGELBARE_KERNFELDER as readonly string[]).includes(field)) {
      return;
    }

    const definitionen = await this.attributeDefinitions.findAll();
    if (definitionen.some((definition) => definition.key === field)) {
      return;
    }

    throw new BadRequestException(new UnknownFieldError(field).message);
  }

  /**
   * Die fuer diesen Mandanten geltenden Regeln als Nachschlagewerk, Feld auf Modus.
   *
   * Je Feld genau eine Regel - die mandantenspezifische schlaegt die plattformweite
   * (ADR-0026 Punkt 5). Haetten beide Bestand, staenden zwei Antworten auf dieselbe Frage
   * in derselben Karte, und welche gewinnt, entschiede die Reihenfolge der Zeilen.
   */
  async regeln(tenant: string): Promise<Map<string, MastershipRuleRow["mode"]>> {
    const zeilen = spezifischsteJe(
      await this.repository.findKandidaten(tenant),
      (regel) => regel.field,
    );

    return new Map(zeilen.map((zeile) => [zeile.field, zeile.mode]));
  }

  private static toResponse(row: MastershipRuleRow): MastershipRuleResponse {
    return {
      id: row.id,
      field: row.field,
      mode: row.mode,
      bindings: row.bindings,
      tenant: row.tenant,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }

  private static toVersionResponse(row: MastershipRuleHistoryRow): MastershipRuleVersionResponse {
    return {
      ...MastershipService.toResponse(row),
      validFrom: row.validFrom.toISOString(),
      validTo: row.validTo?.toISOString() ?? null,
      operation: row.operation,
      changedBy: row.changedBy,
      changeSource: row.changeSource,
    };
  }
}
