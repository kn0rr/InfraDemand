CREATE TYPE "public"."workflow_mode" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TABLE "workflow_definition_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" uuid NOT NULL,
	"label" text NOT NULL,
	"requirement_type" text,
	"mode" "workflow_mode" DEFAULT 'internal' NOT NULL,
	"initial_state" text NOT NULL,
	"states" jsonb NOT NULL,
	"transitions" jsonb NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"operation" "history_operation" NOT NULL,
	"changed_by" text NOT NULL,
	"change_source" text NOT NULL,
	CONSTRAINT "workflow_definition_history_id_version_uq" UNIQUE("id","version")
);
--> statement-breakpoint
CREATE TABLE "workflow_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"requirement_type" text,
	"mode" "workflow_mode" NOT NULL,
	"initial_state" text NOT NULL,
	"states" jsonb NOT NULL,
	"transitions" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "workflow_definition_requirement_type_uq" UNIQUE NULLS NOT DISTINCT("requirement_type")
);
--> statement-breakpoint
CREATE INDEX "workflow_definition_history_id_valid_from_idx" ON "workflow_definition_history" USING btree ("id","valid_from");