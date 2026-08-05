import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Kernentitaet nach CLAUDE.md §6: feste, fachlich stabile Felder plus ein Feld fuer
 * dynamische Attribute. Die Validierung der dynamischen Attribute gegen die zur Laufzeit
 * geladene Definition folgt in M3 - das Feld existiert aber ab jetzt, damit das
 * Datenmodell sie nicht ausschliesst.
 */
export const requirements = pgTable(
  "requirement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    requirementType: text("requirement_type").notNull(),
    status: text("status").notNull(),
    owner: text("owner").notNull(),
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
    // GIN ist die Voraussetzung dafuer, dass Abfragen auf JSON-Pfaden (§6) einen Index nutzen
    index("requirement_dynamic_attributes_idx").using("gin", table.dynamicAttributes),
  ],
);

export type RequirementRow = typeof requirements.$inferSelect;
export type NewRequirementRow = typeof requirements.$inferInsert;
