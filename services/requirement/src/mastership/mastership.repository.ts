import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { istEindeutigkeitsverletzung } from "../database/fehler";
import {
  MASTERSHIP_RULE_FIELD_BINDINGS_CONSTRAINT,
  type MastershipRuleHistoryRow,
  type MastershipRuleRow,
  mastershipRuleHistory,
  mastershipRules,
} from "../database/schema";
import { DuplicateMastershipRuleError, MastershipRuleNotFoundError } from "./mastership.errors";

export interface MastershipRuleInput {
  field: string;
  mode: MastershipRuleRow["mode"];
  changedBy: string;
  changeSource: string;
}

@Injectable()
export class MastershipRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(): Promise<MastershipRuleRow[]> {
    return this.db.select().from(mastershipRules).orderBy(asc(mastershipRules.field));
  }

  findVersions(id: string): Promise<MastershipRuleHistoryRow[]> {
    return this.db
      .select()
      .from(mastershipRuleHistory)
      .where(eq(mastershipRuleHistory.id, id))
      .orderBy(asc(mastershipRuleHistory.version));
  }

  async create(eingabe: MastershipRuleInput): Promise<MastershipRuleRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [zeile] = await tx
          .insert(mastershipRules)
          .values({ field: eingabe.field, mode: eingabe.mode })
          .returning();

        if (!zeile) {
          throw new Error("Anlage lieferte keine Zeile zurueck");
        }

        await tx.insert(mastershipRuleHistory).values({
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
      if (istEindeutigkeitsverletzung(fehler, MASTERSHIP_RULE_FIELD_BINDINGS_CONSTRAINT)) {
        throw new DuplicateMastershipRuleError(eingabe.field);
      }
      throw fehler;
    }
  }

  /**
   * Erzeugt eine neue Version (ADR-0012). Die bisher aktuelle wird geschlossen, die neue
   * beginnt im selben Augenblick - die Zeitraeume stossen lueckenlos aneinander.
   *
   * `field` und `bindings` aendern sich nicht: Sie bezeichnen die Regel. Ein anderes
   * Feld ist eine andere Regel.
   */
  async updateMode(
    id: string,
    mode: MastershipRuleRow["mode"],
    herkunft: { changedBy: string; changeSource: string },
  ): Promise<MastershipRuleRow> {
    return this.db.transaction(async (tx) => {
      const [zeile] = await tx
        .update(mastershipRules)
        .set({
          mode,
          updatedAt: new Date(),
          version: sql`${mastershipRules.version} + 1`,
        })
        .where(eq(mastershipRules.id, id))
        .returning();

      if (!zeile) {
        throw new MastershipRuleNotFoundError(id);
      }

      await tx
        .update(mastershipRuleHistory)
        .set({ validTo: zeile.updatedAt })
        .where(and(eq(mastershipRuleHistory.id, id), isNull(mastershipRuleHistory.validTo)));

      await tx.insert(mastershipRuleHistory).values({
        ...zeile,
        validFrom: zeile.updatedAt,
        validTo: null,
        operation: "update",
        changedBy: herkunft.changedBy,
        changeSource: herkunft.changeSource,
      });

      return zeile;
    });
  }
}
