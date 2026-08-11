import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { istEindeutigkeitsverletzung } from "../database/fehler";
import {
  requirements,
  WORKFLOW_REQUIREMENT_TYPE_CONSTRAINT,
  type WorkflowDefinitionHistoryRow,
  type WorkflowDefinitionRow,
  workflowDefinitionHistory,
  workflowDefinitions,
} from "../database/schema";
import type { Betriebsart, WorkflowState, WorkflowTransition } from "./typen";
import {
  DuplicateWorkflowRequirementTypeError,
  WorkflowDefinitionNotFoundError,
} from "./workflows.errors";

export interface Fassungsnutzung {
  version: number;
  anzahl: number;
}

export interface WorkflowDefinitionCreateInput {
  label: string;
  requirementType: string | null;
  mode: Betriebsart;
  initialState: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  changedBy: string;
  changeSource: string;
}

/**
 * `requirementType` fehlt bewusst - aus demselben Grund wie `key` bei den
 * Attributdefinitionen: Er bezeichnet, **wofuer** der Workflow gilt. Ihn zu aendern
 * naehme dem alten Typ seinen Graphen und gaebe dem neuen einen anderen, ohne dass an
 * einer der beiden Anforderungen etwas geschieht, das auffiele.
 *
 * `mode` ist dagegen aenderbar: Dass ein bisher eigengefuehrter Vorgang kuenftig von
 * Jira gefuehrt wird, ist eine gewoehnliche Betriebsentscheidung (ADR-0021 Punkt 4).
 * Laufende Anforderungen bleiben ueber M4.4 auf ihrer Fassung und damit auf der alten
 * Betriebsart.
 */
export interface WorkflowDefinitionUpdateInput {
  label: string;
  mode: Betriebsart;
  initialState: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  active: boolean;
  changedBy: string;
  changeSource: string;
}

@Injectable()
export class WorkflowsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(): Promise<WorkflowDefinitionRow[]> {
    return this.db.select().from(workflowDefinitions).orderBy(asc(workflowDefinitions.label));
  }

  async findById(id: string): Promise<WorkflowDefinitionRow | undefined> {
    const [zeile] = await this.db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, id))
      .limit(1);

    return zeile;
  }

  /**
   * Der fuer einen Anforderungstyp geltende Workflow: der typbezogene, sonst der
   * allgemeine (`requirement_type IS NULL`). `NULLS LAST` sorgt dafuer, dass der
   * typbezogene gewinnt.
   *
   * **Ohne Filter auf `active`, und das ist Absicht.** Wuerde hier gefiltert, fiele ein
   * ausser Kraft gesetzter typbezogener Workflow lautlos auf den allgemeinen zurueck -
   * die Anforderungen dieses Typs liefen ab dem Moment durch einen **anderen Graphen**,
   * ohne dass jemand das angeordnet haette. Die Entscheidung, was ein inaktiver Workflow
   * bedeutet, gehoert deshalb in die Service-Schicht, wo sie sichtbar ist.
   *
   * Unterscheidet damit anders als `findForRequirementType` bei den Attributdefinitionen,
   * wo typbezogene und allgemeine Definitionen **beide** gelten. Hier gilt genau eine:
   * Zwei Graphen fuer denselben Typ waeren nicht entscheidbar.
   */
  async findForRequirementType(
    requirementType: string,
  ): Promise<WorkflowDefinitionRow | undefined> {
    const [zeile] = await this.db
      .select()
      .from(workflowDefinitions)
      .where(
        or(
          eq(workflowDefinitions.requirementType, requirementType),
          isNull(workflowDefinitions.requirementType),
        ),
      )
      .orderBy(sql`${workflowDefinitions.requirementType} nulls last`)
      .limit(1);

    return zeile;
  }

  /** Alle Versionen einer Definition, aelteste zuerst. */
  findVersions(id: string): Promise<WorkflowDefinitionHistoryRow[]> {
    return this.db
      .select()
      .from(workflowDefinitionHistory)
      .where(eq(workflowDefinitionHistory.id, id))
      .orderBy(asc(workflowDefinitionHistory.version));
  }

  /**
   * Eine bestimmte Fassung. Das ist der Lesepfad, den M4.4 braucht: Eine laufende
   * Anforderung haelt Nummer und Version, und der Graph steht vollstaendig in dieser
   * einen Zeile.
   */
  async findVersion(
    id: string,
    version: number,
  ): Promise<WorkflowDefinitionHistoryRow | undefined> {
    const [zeile] = await this.db
      .select()
      .from(workflowDefinitionHistory)
      .where(
        and(eq(workflowDefinitionHistory.id, id), eq(workflowDefinitionHistory.version, version)),
      )
      .limit(1);

    return zeile;
  }
  /**
   * Wie viele Anforderungen auf welcher Fassung laufen (ADR-0025 Punkt 3).
   *
   * **Liest `requirement`, obwohl das Modul Workflows heisst.** Die Frage gilt einem
   * Workflow, die Antwort steht bei den Anforderungen; der umgekehrte Weg - der
   * Workflow-Service fragt das Requirements-Repository - erzeugte einen Modulkreis. Beide
   * Tabellen gehoeren demselben Dienst, und die Eigentumsregel aus `services.md` bezieht
   * sich auf Dienste, nicht auf Module.
   *
   * Nutzt `requirement_workflow_idx` aus M4.2 - den ersten Leser, den dieser Index hat.
   */
  fassungsnutzung(id: string): Promise<Fassungsnutzung[]> {
    return this.db
      .select({
        version: requirements.workflowVersion,
        // `::int`, weil `count()` in PostgreSQL bigint liefert und der Treiber daraus
        // eine Zeichenkette macht.
        anzahl: sql<number>`count(*)::int`,
      })
      .from(requirements)
      .where(eq(requirements.workflowDefinitionId, id))
      .groupBy(requirements.workflowVersion)
      .orderBy(asc(requirements.workflowVersion));
  }

  async create(eingabe: WorkflowDefinitionCreateInput): Promise<WorkflowDefinitionRow> {
    try {
      return await this.db.transaction(async (tx) => {
        const [zeile] = await tx
          .insert(workflowDefinitions)
          .values({
            label: eingabe.label,
            requirementType: eingabe.requirementType,
            // Die Fachtabelle hat keinen Vorgabewert fuer `mode`. Das ist der Gewinn
            // daraus: Der Uebersetzer verlangt die Angabe hier, statt sie stillschweigend
            // auf "internal" zu setzen.
            mode: eingabe.mode,
            initialState: eingabe.initialState,
            states: eingabe.states,
            transitions: eingabe.transitions,
          })
          .returning();

        if (!zeile) {
          throw new Error("Anlage lieferte keine Zeile zurueck");
        }

        await tx.insert(workflowDefinitionHistory).values({
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
      if (istEindeutigkeitsverletzung(fehler, WORKFLOW_REQUIREMENT_TYPE_CONSTRAINT)) {
        throw new DuplicateWorkflowRequirementTypeError(eingabe.requirementType);
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
  async update(id: string, eingabe: WorkflowDefinitionUpdateInput): Promise<WorkflowDefinitionRow> {
    return this.db.transaction(async (tx) => {
      const [zeile] = await tx
        .update(workflowDefinitions)
        .set({
          label: eingabe.label,
          mode: eingabe.mode,
          initialState: eingabe.initialState,
          states: eingabe.states,
          transitions: eingabe.transitions,
          active: eingabe.active,
          updatedAt: new Date(),
          version: sql`${workflowDefinitions.version} + 1`,
        })
        .where(eq(workflowDefinitions.id, id))
        .returning();

      if (!zeile) {
        throw new WorkflowDefinitionNotFoundError(id);
      }

      await tx
        .update(workflowDefinitionHistory)
        .set({ validTo: zeile.updatedAt })
        .where(
          and(eq(workflowDefinitionHistory.id, id), isNull(workflowDefinitionHistory.validTo)),
        );

      await tx.insert(workflowDefinitionHistory).values({
        ...zeile,
        validFrom: zeile.updatedAt,
        validTo: null,
        // Wie bei den Attributdefinitionen nie "delete": Eine laufende Anforderung haelt
        // ihre Fassung ueber diese Historie. Ein "delete" naehme sie aus der
        // Stichtagsabfrage - und die Anforderung haette keinen Graphen mehr.
        operation: "update",
        changedBy: eingabe.changedBy,
        changeSource: eingabe.changeSource,
      });

      return zeile;
    });
  }
}
