CREATE TYPE "public"."history_operation" AS ENUM('insert', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "requirement_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"requirement_type" text NOT NULL,
	"status" text NOT NULL,
	"owner" text NOT NULL,
	"source_system" text NOT NULL,
	"external_id" text,
	"dynamic_attributes" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"operation" "history_operation" NOT NULL,
	"changed_by" text NOT NULL,
	"change_source" text NOT NULL,
	CONSTRAINT "requirement_history_id_version_uq" UNIQUE("id","version")
);
--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "source_system" text DEFAULT 'infrademand' NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX "requirement_history_id_valid_from_idx" ON "requirement_history" USING btree ("id","valid_from");--> statement-breakpoint
CREATE INDEX "requirement_history_validity_idx" ON "requirement_history" USING btree ("valid_from","valid_to");--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_source_external_uq" UNIQUE("source_system","external_id");