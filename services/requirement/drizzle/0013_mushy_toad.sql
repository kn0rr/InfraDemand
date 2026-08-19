ALTER TABLE "attribute_definition_history" ADD COLUMN "visible_for" jsonb;--> statement-breakpoint
ALTER TABLE "attribute_definition" ADD COLUMN "visible_for" jsonb;