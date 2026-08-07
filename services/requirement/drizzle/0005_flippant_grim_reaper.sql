CREATE TYPE "public"."rejection_reason" AS ENUM('automatic_wins', 'manual_locked', 'field_held');--> statement-breakpoint
CREATE TABLE "write_rejection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"field" text NOT NULL,
	"rejected_value" jsonb,
	"source_system" text NOT NULL,
	"changed_by" text NOT NULL,
	"reason" "rejection_reason" NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "write_rejection" ADD CONSTRAINT "write_rejection_requirement_id_requirement_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "write_rejection_requirement_field_idx" ON "write_rejection" USING btree ("requirement_id","field","occurred_at");