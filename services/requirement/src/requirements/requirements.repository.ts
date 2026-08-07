import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, isNull, lte, ne, or, sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { istEindeutigkeitsverletzung } from "../database/fehler";
import {
  type NewWriteRejectionRow,
  REQUIREMENT_SOURCE_EXTERNAL_CONSTRAINT,
  type RequirementHistoryRow,
  type RequirementRow,
  requirementHistory,
  requirements,
  writeRejections,
} from "../database/schema";
import { DuplicateExternalIdError, RequirementNotFoundError } from "./requirements.errors";

export interface RequirementCreateInput {
  projectId: string;
  requirementType: string;
  status: string;
  owner: string;
  sourceSystem: string;
  externalId: string | null;
  dynamicAttributes: Record<string, unknown>;
  /** Ausloesende Identitaet aus dem Token. */
  changedBy: string;
  /** Client, der die Aenderung ausgefuehrt hat - aus dem Token, nicht vom Aufrufer. */
  changeSource: string;
}

export interface RequirementUpdateInput {
  projectId: string;
  requirementType: string;
  status: string;
  owner: string;
  dynamicAttributes: Record<string, unknown>;
  changedBy: string;
  changeSource: string;
}

@Injectable()
export class RequirementsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(): Promise<RequirementRow[]> {
    return this.db.select().from(requirements).orderBy(asc(requirements.createdAt));
  }

  /**
   * Bestand zu einem Stichtag. Genau eine Version je Datensatz erfuellt die Bedingung,
   * weil sich die Gueltigkeitszeitraeume nicht ueberlappen.
   *
   * Geloeschte Datensaetze werden ausgeschlossen: Deren letzte Version traegt
   * operation = "delete" und beschreibt den Zustand "nicht mehr vorhanden".
   */
  findAsOf(zeitpunkt: Date): Promise<RequirementHistoryRow[]> {
    return this.db
      .select()
      .from(requirementHistory)
      .where(
        and(
          lte(requirementHistory.validFrom, zeitpunkt),
          or(gt(requirementHistory.validTo, zeitpunkt), isNull(requirementHistory.validTo)),
          ne(requirementHistory.operation, "delete"),
        ),
      )
      .orderBy(asc(requirementHistory.createdAt));
  }

  /** Alle Versionen eines Datensatzes, aelteste zuerst. */
  findVersions(id: string): Promise<RequirementHistoryRow[]> {
    return this.db
      .select()
      .from(requirementHistory)
      .where(eq(requirementHistory.id, id))
      .orderBy(asc(requirementHistory.version));
  }

  /**
   * Legt einen Datensatz an und schreibt die erste Version der Historie - beides in
   * **einer** Transaktion (ADR-0012). Schlaegt der zweite Schreibvorgang fehl, entsteht
   * kein Datensatz ohne Nachweis.
   */
  async create(eingabe: RequirementCreateInput): Promise<RequirementRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [zeile] = await tx
          .insert(requirements)
          .values({
            projectId: eingabe.projectId,
            requirementType: eingabe.requirementType,
            status: eingabe.status,
            owner: eingabe.owner,
            sourceSystem: eingabe.sourceSystem,
            externalId: eingabe.externalId,
            dynamicAttributes: eingabe.dynamicAttributes,
          })
          .returning();

        if (!zeile) {
          throw new Error("Anlage lieferte keine Zeile zurueck");
        }

        await tx.insert(requirementHistory).values({
          id: zeile.id,
          projectId: zeile.projectId,
          requirementType: zeile.requirementType,
          status: zeile.status,
          owner: zeile.owner,
          sourceSystem: zeile.sourceSystem,
          externalId: zeile.externalId,
          dynamicAttributes: zeile.dynamicAttributes,
          createdAt: zeile.createdAt,
          updatedAt: zeile.updatedAt,
          version: zeile.version,
          // Derselbe Zeitstempel wie in der Fachtabelle: eine Zeitquelle, keine zwei
          validFrom: zeile.updatedAt,
          validTo: null,
          operation: "insert",
          changedBy: eingabe.changedBy,
          changeSource: eingabe.changeSource,
        });

        return zeile;
      });
    } catch (fehler) {
      if (istEindeutigkeitsverletzung(fehler, REQUIREMENT_SOURCE_EXTERNAL_CONSTRAINT)) {
        throw new DuplicateExternalIdError(eingabe.sourceSystem, eingabe.externalId ?? "");
      }
      throw fehler;
    }
  }

  /**
   * Verzeichnet abgewiesene Schreiboperationen (ADR-0017 B10).
   *
   * Bewusst ausserhalb der Schreibtransaktion: Bei einer manuellen Abweisung scheitert
   * der Vorgang (ADR-0019 Punkt 1), und der Eintrag soll trotzdem bestehen bleiben. Er
   * belegt gerade, was **nicht** geschah.
   */
  async recordRejections(eintraege: NewWriteRejectionRow[]): Promise<void> {
    if (eintraege.length === 0) {
      return;
    }

    await this.db.insert(writeRejections).values(eintraege);
  }

  /** Zuordnung des fremden Bezeichners auf unseren Datensatz (ADR-0010). */
  async findBySource(
    sourceSystem: string,
    externalId: string,
  ): Promise<RequirementRow | undefined> {
    const [zeile] = await this.db
      .select()
      .from(requirements)
      .where(
        and(eq(requirements.sourceSystem, sourceSystem), eq(requirements.externalId, externalId)),
      )
      .limit(1);

    return zeile;
  }

  /**
   * Erzeugt eine neue Version (ADR-0012). Die bisher aktuelle wird geschlossen, die neue
   * beginnt im selben Augenblick - `validTo` der alten und `validFrom` der neuen tragen
   * denselben Wert. Die Zeitraeume stossen lueckenlos aneinander und ueberlappen nicht.
   *
   * `sourceSystem` und `externalId` aendern sich nie: Sie sind die Adresse des
   * Datensatzes ueber die Servicegrenze hinweg.
   */
  async update(id: string, eingabe: RequirementUpdateInput): Promise<RequirementRow> {
    return this.db.transaction(async (tx) => {
      const [zeile] = await tx
        .update(requirements)
        .set({
          projectId: eingabe.projectId,
          requirementType: eingabe.requirementType,
          status: eingabe.status,
          owner: eingabe.owner,
          dynamicAttributes: eingabe.dynamicAttributes,
          updatedAt: new Date(),
          version: sql`${requirements.version} + 1`,
        })
        .where(eq(requirements.id, id))
        .returning();

      if (!zeile) {
        throw new Error(`Datensatz ${id} verschwand waehrend der Aenderung`);
      }

      await tx
        .update(requirementHistory)
        .set({ validTo: zeile.updatedAt })
        .where(and(eq(requirementHistory.id, id), isNull(requirementHistory.validTo)));

      await tx.insert(requirementHistory).values({
        id: zeile.id,
        projectId: zeile.projectId,
        requirementType: zeile.requirementType,
        status: zeile.status,
        owner: zeile.owner,
        sourceSystem: zeile.sourceSystem,
        externalId: zeile.externalId,
        dynamicAttributes: zeile.dynamicAttributes,
        createdAt: zeile.createdAt,
        updatedAt: zeile.updatedAt,
        version: zeile.version,
        validFrom: zeile.updatedAt,
        validTo: null,
        operation: "update",
        changedBy: eingabe.changedBy,
        changeSource: eingabe.changeSource,
      });

      return zeile;
    });
  }
}
