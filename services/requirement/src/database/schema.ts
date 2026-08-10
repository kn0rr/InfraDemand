import { sql } from "drizzle-orm";
import {
  boolean,
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

/** Name der Eindeutigkeit je Schluessel und Anforderungstyp (§6). */
export const ATTRIBUTE_DEFINITION_KEY_TYPE_CONSTRAINT = "attribute_definition_key_type_uq";
/** Art der Änderung in der Versionshistorie (ADR-0012). */
export const historyOperation = pgEnum("history_operation", ["insert", "update", "delete"]);

/**
 * Spalten, die jede Historientabelle nach
 * [ADR-0012](../../../../docs/adr/0012-vollstaendige-versionierung-mit-zeitbezug.md) traegt.
 *
 * Eine Funktion und keine Konstante: Drizzle bindet Spaltenbauer beim Erzeugen der
 * Tabelle an genau diese Tabelle. Dieselben Bauer in zwei Tabellen zu verwenden waere
 * ein stiller Fehler - jeder Aufruf liefert deshalb frische.
 */
function versionierungsSpalten() {
  return {
    version: integer("version").notNull(),
    /** Beginn des Zeitraums, in dem diese Version galt. */
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    /** Ende; leer bei der aktuellen Version. */
    validTo: timestamp("valid_to", { withTimezone: true }),
    operation: historyOperation("operation").notNull(),
    /** Ausloesende Identitaet: Benutzer oder Service Account. */
    changedBy: text("changed_by").notNull(),
    /** Quelle **dieser Aenderung** (§19.3) - nicht zwingend die Herkunft des Datensatzes. */
    changeSource: text("change_source").notNull(),
  };
}

/** Klasse einer Quelle nach ADR-0017 A4. Entscheidet ueber die Hoheitsregel. */
export const sourceSystemKind = pgEnum("source_system_kind", ["automatic", "manual"]);

/**
 * Registratur der Herkunftssysteme (ADR-0017 A4).
 *
 * Ohne sie laesst sich zu einer Schreiboperation nicht bestimmen, ob sie automatisch oder
 * manuell erfolgt - und damit greift keine einzige Hoheitsregel aus §19.3.
 *
 * Der Schluessel ist zugleich der Primaerschluessel: Er ist der Bezeichner, den
 * Fremdsysteme ueber die Schnittstelle mitgeben, und er muss stabil sein.
 */
export const sourceSystems = pgTable("source_system", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  kind: sourceSystemKind("kind").notNull(),
  /**
   * Ausser Betrieb genommene Quellen bleiben bestehen. Sie duerfen nicht geloescht
   * werden, weil Datensaetze und deren Historie auf sie verweisen - fachliche Loeschung
   * statt physischer, wie in ADR-0012 Punkt 6.
   */
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

/** Versionshistorie der Registratur. Gleiches Muster wie requirement_history (ADR-0012). */
export const sourceSystemHistory = pgTable(
  "source_system_history",
  {
    historyId: uuid("history_id").primaryKey().defaultRandom(),

    key: text("key").notNull(),
    label: text("label").notNull(),
    kind: sourceSystemKind("kind").notNull(),
    active: boolean("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    ...versionierungsSpalten(),
  },
  (table) => [
    index("source_system_history_key_valid_from_idx").on(table.key, table.validFrom),
    unique("source_system_history_key_version_uq").on(table.key, table.version),
  ],
);

/**
 * Festhaltung eines Feldes gegen automatische Uebernahme (ADR-0017 B6 bis B9).
 *
 * Die Begruendung ist Pflicht (B8): Sie erzeugt eine dauerhafte, gewollte Abweichung vom
 * Herkunftssystem, und wer sie Monate spaeter vorfindet, muss erkennen koennen, warum sie
 * besteht - sonst bleibt nur, sie aufzuheben und abzuwarten, was kaputtgeht.
 */
export interface Festhaltung {
  /** Wer sie gesetzt hat. */
  by: string;
  /** Wann, als ISO-8601-Zeitpunkt. */
  at: string;
  /** Warum. */
  reason: string;
}

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

    /** Herkunftssystem des Datensatzes (§19.1). Eigene Erfassung: "infrademand".
     *  Fremdschluessel auf die Registratur: Eine Quelle, deren Klasse unbekannt ist,
     *  darf nicht schreiben (ADR-0017 A4). */
    sourceSystem: text("source_system")
      .notNull()
      .default("infrademand")
      .references(() => sourceSystems.key),
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

    /**
     * Felder, die gegen automatische Uebernahme festgehalten sind (ADR-0017 B6).
     * Schluessel ist der Feldname, Wert die Festhaltung.
     *
     * Bewusst eine Spalte und keine eigene Entitaet: B9 verlangt, dass die Festhaltung
     * Bestandteil des versionierten Zustands ist - als Spalte wandert sie ohne
     * Zusatzaufwand in die Historie, und eine Stichtagsabfrage zeigt, was damals
     * festgehalten war.
     */
    heldFields: jsonb("held_fields").$type<Record<string, Festhaltung>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("requirement_project_idx").on(table.projectId),
    index("requirement_status_idx").on(table.status),
    index("requirement_dynamic_attributes_idx").using("gin", table.dynamicAttributes),
    // Zugriffspfad der Uebersicht aus ADR-0017 B14. Teilindex, weil der ueberwiegende
    // Teil der Datensaetze nichts festhaelt - ein voller Index waere fast leer und
    // trotzdem bei jedem Schreibvorgang zu pflegen.
    index("requirement_held_fields_idx")
      .on(table.id)
      .where(sql`${table.heldFields} <> '{}'::jsonb`),
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
    heldFields: jsonb("held_fields").$type<Record<string, Festhaltung>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    // --- Versionierung ---
    ...versionierungsSpalten(),
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

/**
 * Datentyp eines dynamischen Attributs (§6).
 *
 * Fester Satz im Code, bewusst keine Stammdaten: Jeder Typ braucht einen Pruefer (M3.3)
 * und ein Formularfeld (M3.5), und beides ist Code. §6 macht die Attribut*definitionen*
 * zu Fachdaten, nicht das Typsystem selbst.
 */
export const attributeDataType = pgEnum("attribute_data_type", [
  "text",
  "number",
  "boolean",
  "date",
  "enum",
  "multi_enum",
]);

/**
 * Attributdefinition nach §6 - Fachdaten, versioniert, ohne Redeploy aenderbar.
 *
 * Geprueft wird zur Laufzeit gegen die **aktuell gueltige** Definition, nicht gegen die
 * bei Anlage der Anforderung geltende. §6 legt das ausdruecklich so fest. Das ist der
 * Unterschied zu §7, wo laufende Anforderungen auf ihrer Workflow-Fassung bleiben - die
 * Historie hier dient der Nachweisfuehrung und Stichtagsauswertung, nicht der Festlegung.
 */
export const attributeDefinitions = pgTable(
  "attribute_definition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Schluessel im JSONB-Feld `dynamic_attributes` der Anforderung. */
    key: text("key").notNull(),
    /** Anforderungstyp, fuer den die Definition gilt. NULL bedeutet: fuer alle. */
    requirementType: text("requirement_type"),
    label: text("label").notNull(),
    dataType: attributeDataType("data_type").notNull(),
    required: boolean("required").notNull().default(false),
    /** Vorgabewert, dem Datentyp entsprechend. */
    defaultValue: jsonb("default_value"),
    /** Zulaessige Werte bei `enum` und `multi_enum`; sonst leer. */
    allowedValues: jsonb("allowed_values").$type<string[]>(),
    /**
     * Ausser Kraft gesetzte Definitionen bleiben bestehen. Sie werden nicht geloescht,
     * weil bestehende Anforderungen Werte tragen, die nur mit ihnen deutbar sind
     * (ADR-0012 Punkt 6).
     */
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    /**
     * Ein Schluessel je Anforderungstyp. `nullsNotDistinct` ist erforderlich: Ohne sie
     * behandelt PostgreSQL zwei NULL-Werte als verschieden, und es koennte mehrere
     * allgemeingueltige Definitionen desselben Schluessels geben.
     */
    unique(ATTRIBUTE_DEFINITION_KEY_TYPE_CONSTRAINT)
      .on(table.key, table.requirementType)
      .nullsNotDistinct(),
    index("attribute_definition_type_idx").on(table.requirementType),
  ],
);

/** Versionshistorie der Attributdefinitionen (ADR-0012). */
export const attributeDefinitionHistory = pgTable(
  "attribute_definition_history",
  {
    historyId: uuid("history_id").primaryKey().defaultRandom(),

    // --- fachlicher Zeilenzustand, Kopie der Fachtabelle ---
    id: uuid("id").notNull(),
    key: text("key").notNull(),
    requirementType: text("requirement_type"),
    label: text("label").notNull(),
    dataType: attributeDataType("data_type").notNull(),
    required: boolean("required").notNull(),
    defaultValue: jsonb("default_value"),
    allowedValues: jsonb("allowed_values").$type<string[]>(),
    active: boolean("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    ...versionierungsSpalten(),
  },
  (table) => [
    index("attribute_definition_history_id_valid_from_idx").on(table.id, table.validFrom),
    unique("attribute_definition_history_id_version_uq").on(table.id, table.version),
  ],
);
/** Regelvokabular der Datenhoheit (ADR-0017 A2). */
export const mastershipMode = pgEnum("mastership_mode", [
  "manual_allowed",
  "automatic_wins",
  "manual_locked",
]);

/** Name der Eindeutigkeit je Feld und Geltungsbereich. */
export const MASTERSHIP_RULE_FIELD_BINDINGS_CONSTRAINT = "mastership_rule_field_bindings_uq";

/**
 * Hoheitsregel nach §19.3 und [ADR-0017](../../../../docs/adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md).
 *
 * Die Regel benennt eine **Quellenklasse**, kein konkretes System. Dadurch wirkt sie nur
 * dort, wo eine automatische Quelle das Feld tatsaechlich bespielt - und braucht keinen
 * Geltungsbereich (A1, A5).
 *
 * Kein `active`: Der Vorgabewert `manual_allowed` ist selbst der Zustand "keine
 * Einschraenkung". Eine Regel abzuschalten und sie auf den Vorgabewert zu setzen waere
 * dasselbe.
 */
export const mastershipRules = pgTable(
  "mastership_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Feld, fuer das die Regel gilt - ein Kernfeld wie `owner` oder der Schluessel eines
     * dynamischen Attributs. Bewusst ohne Fremdschluessel auf `attribute_definition`:
     * Kernfelder stehen dort nicht.
     */
    field: text("field").notNull(),
    mode: mastershipMode("mode").notNull(),
    /**
     * Geltungsbereich (ADR-0017 A6). Bleibt vorerst leer, und kein Code setzt voraus,
     * dass er leer ist. Teil der Eindeutigkeit, damit eine zweite Regel fuer dasselbe
     * Feld spaeter ein INSERT bleibt und keine Schemaaenderung verlangt.
     */
    bindings: jsonb("bindings").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    // jsonb normalisiert die Schluesselreihenfolge - {"a":1,"b":2} und {"b":2,"a":1}
    // gelten als derselbe Geltungsbereich. Genau das ist gewollt.
    unique(MASTERSHIP_RULE_FIELD_BINDINGS_CONSTRAINT).on(table.field, table.bindings),
  ],
);

/** Versionshistorie der Hoheitsregeln (ADR-0012). */
export const mastershipRuleHistory = pgTable(
  "mastership_rule_history",
  {
    historyId: uuid("history_id").primaryKey().defaultRandom(),

    id: uuid("id").notNull(),
    field: text("field").notNull(),
    mode: mastershipMode("mode").notNull(),
    bindings: jsonb("bindings").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),

    ...versionierungsSpalten(),
  },
  (table) => [
    index("mastership_rule_history_id_valid_from_idx").on(table.id, table.validFrom),
    unique("mastership_rule_history_id_version_uq").on(table.id, table.version),
  ],
);

/** Warum eine Schreiboperation auf ein Feld abgewiesen wurde. */
export const rejectionReason = pgEnum("rejection_reason", [
  "automatic_wins",
  "manual_locked",
  /** Wird ab M3.4d verwendet - Festhaltung je Datensatz und Feld (ADR-0017 B6). */
  "field_held",
]);

/**
 * Abgewiesene Schreiboperationen (ADR-0017 B10).
 *
 * **Keine Version** (ADR-0017 B11): Eine abgewiesene Operation aendert den Datensatz
 * nicht. Sie als Version zu fuehren erzeugte Versionen, die sich von ihrer Vorgaengerin
 * nicht unterscheiden. Der Speicher beantwortet eine andere Frage als die Historie -
 * nicht "wie sah der Datensatz aus", sondern "was hat eine Quelle geliefert, das wir
 * nicht uebernommen haben".
 *
 * Nur fuer bestehende Datensaetze (ADR-0019 Punkt 4): Scheitert eine Anlage, gibt es
 * keinen Wert, bei dem wir geblieben waeren.
 *
 * Nur angefuegt, nie geaendert - deshalb ohne Versionierungsspalten.
 */
export const writeRejections = pgTable(
  "write_rejection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id),
    field: text("field").notNull(),
    /** Der Wert, den die Quelle setzen wollte. `null` ist ein zulaessiger Wunsch. */
    rejectedValue: jsonb("rejected_value"),
    /** Herkunft der abgewiesenen Operation, nicht des Datensatzes. */
    sourceSystem: text("source_system").notNull(),
    changedBy: text("changed_by").notNull(),
    reason: rejectionReason("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Zugriffspfad der Uebersicht aus ADR-0017 B14: die zuletzt abgewiesene Lieferung
    // je Datensatz und Feld.
    index("write_rejection_requirement_field_idx").on(
      table.requirementId,
      table.field,
      table.occurredAt,
    ),
  ],
);

export type RequirementRow = typeof requirements.$inferSelect;
export type NewRequirementRow = typeof requirements.$inferInsert;
export type RequirementHistoryRow = typeof requirementHistory.$inferSelect;
export type NewRequirementHistoryRow = typeof requirementHistory.$inferInsert;
export type SourceSystemRow = typeof sourceSystems.$inferSelect;
export type NewSourceSystemRow = typeof sourceSystems.$inferInsert;
export type SourceSystemHistoryRow = typeof sourceSystemHistory.$inferSelect;
export type AttributeDefinitionRow = typeof attributeDefinitions.$inferSelect;
export type NewAttributeDefinitionRow = typeof attributeDefinitions.$inferInsert;
export type AttributeDefinitionHistoryRow = typeof attributeDefinitionHistory.$inferSelect;
export type MastershipRuleRow = typeof mastershipRules.$inferSelect;
export type MastershipRuleHistoryRow = typeof mastershipRuleHistory.$inferSelect;
export type WriteRejectionRow = typeof writeRejections.$inferSelect;
export type NewWriteRejectionRow = typeof writeRejections.$inferInsert;
