ALTER TABLE "requirement_history" ADD COLUMN "held_fields" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "held_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "requirement_held_fields_idx" ON "requirement" USING btree ("id") WHERE "requirement"."held_fields" <> '{}'::jsonb;