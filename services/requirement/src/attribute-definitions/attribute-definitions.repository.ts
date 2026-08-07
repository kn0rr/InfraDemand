import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { istEindeutigkeitsverletzung } from "../database/fehler";
import {
  ATTRIBUTE_DEFINITION_KEY_TYPE_CONSTRAINT,
  type AttributeDefinitionHistoryRow,
  type AttributeDefinitionRow,
  attributeDefinitionHistory,
  attributeDefinitions,
} from "../database/schema";
import {
  AttributeDefinitionNotFoundError,
  DuplicateAttributeKeyError,
} from "./attribute-definitions.errors";

export interface AttributeDefinitionCreateInput {
  key: string;
  requirementType: string | null;
  label: string;
  dataType: AttributeDefinitionRow["dataType"];
  required: boolean;
  defaultValue: unknown;
  allowedValues: string[] | null;
  changedBy: string;
  changeSource: string;
}

/**
 * `key` und `requirementType` fehlen bewusst: Sie bezeichnen die Definition. Wuerde man
 * den Schluessel aendern, verloeren alle bereits gespeicherten Werte unter dem alten
 * Schluessel ihre Definition - ohne dass es irgendwo auffiele. Ein anderer Schluessel ist
 * eine andere Definition.
 */
export interface AttributeDefinitionUpdateInput {
  label: string;
  dataType: AttributeDefinitionRow["dataType"];
  required: boolean;
  defaultValue: unknown;
  allowedValues: string[] | null;
  active: boolean;
  changedBy: string;
  changeSource: string;
}

@Injectable()
export class AttributeDefinitionsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(): Promise<AttributeDefinitionRow[]> {
    return this.db.select().from(attributeDefinitions).orderBy(asc(attributeDefinitions.key));
  }

  /**
   * Die fuer einen Anforderungstyp geltenden Definitionen: die typbezogenen **und** die
   * allgemeinen. Genau diese Menge braucht die Laufzeitpruefung in M3.3.
   */
  findForRequirementType(requirementType: string): Promise<AttributeDefinitionRow[]> {
    return this.db
      .select()
      .from(attributeDefinitions)
      .where(
        and(
          eq(attributeDefinitions.active, true),
          or(
            eq(attributeDefinitions.requirementType, requirementType),
            isNull(attributeDefinitions.requirementType),
          ),
        ),
      )
      .orderBy(asc(attributeDefinitions.key));
  }

  /** Alle Versionen einer Definition, aelteste zuerst. */
  findVersions(id: string): Promise<AttributeDefinitionHistoryRow[]> {
    return this.db
      .select()
      .from(attributeDefinitionHistory)
      .where(eq(attributeDefinitionHistory.id, id))
      .orderBy(asc(attributeDefinitionHistory.version));
  }

  async create(eingabe: AttributeDefinitionCreateInput): Promise<AttributeDefinitionRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [zeile] = await tx
          .insert(attributeDefinitions)
          .values({
            key: eingabe.key,
            requirementType: eingabe.requirementType,
            label: eingabe.label,
            dataType: eingabe.dataType,
            required: eingabe.required,
            defaultValue: eingabe.defaultValue,
            allowedValues: eingabe.allowedValues,
          })
          .returning();

        if (!zeile) {
          throw new Error("Anlage lieferte keine Zeile zurueck");
        }

        await tx.insert(attributeDefinitionHistory).values({
          ...zeile,
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
      if (istEindeutigkeitsverletzung(fehler, ATTRIBUTE_DEFINITION_KEY_TYPE_CONSTRAINT)) {
        throw new DuplicateAttributeKeyError(eingabe.key, eingabe.requirementType);
      }
      throw fehler;
    }
  }

  /**
   * Erzeugt eine neue Version (ADR-0012). Die bisher aktuelle wird geschlossen, die neue
   * beginnt im selben Augenblick: `validTo` der alten und `validFrom` der neuen tragen
   * denselben Wert. Die Zeitraeume stossen damit lueckenlos aneinander und ueberlappen
   * nicht - eine Stichtagsabfrage findet zu jedem Zeitpunkt genau eine Version.
   */
  async update(
    id: string,
    eingabe: AttributeDefinitionUpdateInput,
  ): Promise<AttributeDefinitionRow> {
    return this.db.transaction(async (tx) => {
      const [zeile] = await tx
        .update(attributeDefinitions)
        .set({
          label: eingabe.label,
          dataType: eingabe.dataType,
          required: eingabe.required,
          defaultValue: eingabe.defaultValue,
          allowedValues: eingabe.allowedValues,
          active: eingabe.active,
          updatedAt: new Date(),
          version: sql`${attributeDefinitions.version} + 1`,
        })
        .where(eq(attributeDefinitions.id, id))
        .returning();

      if (!zeile) {
        throw new AttributeDefinitionNotFoundError(id);
      }

      await tx
        .update(attributeDefinitionHistory)
        .set({ validTo: zeile.updatedAt })
        .where(
          and(eq(attributeDefinitionHistory.id, id), isNull(attributeDefinitionHistory.validTo)),
        );

      await tx.insert(attributeDefinitionHistory).values({
        ...zeile,
        validFrom: zeile.updatedAt,
        validTo: null,
        // Bewusst "update" und nicht "delete", auch beim Ausserkraftsetzen: Eine
        // Definition wird nie geloescht. Bestehende Anforderungen tragen Werte, die
        // ohne sie nicht mehr deutbar waeren - "delete" wuerde sie aus der
        // Stichtagsabfrage entfernen und genau das zerstoeren.
        operation: "update",
        changedBy: eingabe.changedBy,
        changeSource: eingabe.changeSource,
      });

      return zeile;
    });
  }
}
