import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Name der Eindeutigkeit aus §19.1. Wird beim Abfangen des Konflikts gebraucht. */
export const REQUIREMENT_SOURCE_EXTERNAL_CONSTRAINT = "requirement_source_external_uq";
/** Art der Änderung in der Versionshistorie (ADR-0012). */
export const historyOperation = pgEnum("history_operation", ["insert", "update", "delete"]);

/**
 * Kernentitaet nach CLAUDE.md §6 und §19.
 *
 * Fuehrt ausschliesslich den **aktuellen** Zustand. Jede Version - einschliesslich der
 * aktuellen - liegt zusaetzlich in requirement_history (ADR-0012).
 */
export const requirements = pgTable(
  "requirement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    requirementType: text("requirement_type").notNull(),
    status: text("status").notNull(),
    owner: text("owner").notNull(),

    /** Herkunftssystem des Datensatzes (§19.1). Eigene Erfassung: "infrademand". */
    sourceSystem: text("source_system").notNull().default("infrademand"),
    /**
     * Bezeichner im Herkunftssystem. Bewusst NULL fuer eigene Erfassung: Dort gibt es
     * kein externes System, und ein erfundener Wert waere eine Behauptung.
     * PostgreSQL behandelt NULL-Werte in Eindeutigkeiten als verschieden - mehrere
     * eigene Datensaetze kollidieren daher nicht.
     */
    externalId: text("external_id"),

    dynamicAttributes: jsonb("dynamic_attributes")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("requirement_project_idx").on(table.projectId),
    index("requirement_status_idx").on(table.status),
    index("requirement_dynamic_attributes_idx").using("gin", table.dynamicAttributes),
    // Idempotenz nach §19.1: derselbe Datensatz aus derselben Quelle nur einmal
    unique(REQUIREMENT_SOURCE_EXTERNAL_CONSTRAINT).on(table.sourceSystem, table.externalId),
  ],
);

/**
 * Versionshistorie (ADR-0012). Enthaelt **jede** Version einschliesslich der aktuellen -
 * dadurch ist eine Stichtagsabfrage eine Abfrage gegen genau diese Tabelle und kein
 * Zusammensetzen aus zwei Quellen.
 *
 * Zugleich der Auditpfad nach §16: alter Wert, neuer Wert und feldgenaue Herkunft ergeben
 * sich aus dem Vergleich aufeinanderfolgender Versionen.
 */
export const requirementHistory = pgTable(
  "requirement_history",
  {
    historyId: uuid("history_id").primaryKey().defaultRandom(),

    // --- fachlicher Zeilenzustand, Kopie der Fachtabelle ---
    id: uuid("id").notNull(),
    projectId: uuid("project_id").notNull(),
    requirementType: text("requirement_type").notNull(),
    status: text("status").notNull(),
    owner: text("owner").notNull(),
    sourceSystem: text("source_system").notNull(),
    externalId: text("external_id"),
    dynamicAttributes: jsonb("dynamic_attributes").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    // --- Versionierung ---
    version: integer("version").notNull(),
    /** Beginn des Zeitraums, in dem diese Version galt. */
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    /** Ende; leer bei der aktuellen Version. */
    validTo: timestamp("valid_to", { withTimezone: true }),
    operation: historyOperation("operation").notNull(),

    /** Ausloesende Identitaet: Benutzer oder Service Account. */
    changedBy: text("changed_by").notNull(),
    /** Quelle **dieser Aenderung** (§19.3) - nicht zwingend das Herkunftssystem des
     *  Datensatzes. Ein aus SAP stammender Datensatz kann manuell geaendert werden. */
    changeSource: text("change_source").notNull(),
  },
  (table) => [
    // Zugriffspfad jeder Stichtagsabfrage fuer einen einzelnen Datensatz
    index("requirement_history_id_valid_from_idx").on(table.id, table.validFrom),
    // Zugriffspfad fuer Stichtagsabfragen ueber den gesamten Bestand (Grafen, §11)
    index("requirement_history_validity_idx").on(table.validFrom, table.validTo),
    // Ein Datensatz kann keine zwei gleichen Versionsnummern haben
    unique("requirement_history_id_version_uq").on(table.id, table.version),
  ],
);

export type RequirementRow = typeof requirements.$inferSelect;
export type NewRequirementRow = typeof requirements.$inferInsert;
export type RequirementHistoryRow = typeof requirementHistory.$inferSelect;
export type NewRequirementHistoryRow = typeof requirementHistory.$inferInsert;
