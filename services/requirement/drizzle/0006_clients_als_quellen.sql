INSERT INTO "source_system" ("key", "label", "kind") VALUES
  ('frontend', 'Weboberflaeche', 'manual'),
  ('test-cli', 'Testwerkzeug', 'manual')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "source_system_history" ("key", "label", "kind", "active", "created_at", "updated_at", "version", "valid_from", "operation", "changed_by", "change_source")
SELECT "key", "label", "kind", "active", "created_at", "updated_at", 1, "created_at", 'insert', 'migration', 'infrademand'
FROM "source_system" WHERE "key" IN ('frontend', 'test-cli')
  AND NOT EXISTS (SELECT 1 FROM "source_system_history" h WHERE h.key = "source_system"."key");
