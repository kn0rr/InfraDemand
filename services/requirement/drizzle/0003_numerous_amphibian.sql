CREATE TYPE "public"."attribute_data_type" AS ENUM('text', 'number', 'boolean', 'date', 'enum', 'multi_enum');--> statement-breakpoint
CREATE TABLE "attribute_definition_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" uuid NOT NULL,
	"key" text NOT NULL,
	"requirement_type" text,
	"label" text NOT NULL,
	"data_type" "attribute_data_type" NOT NULL,
	"required" boolean NOT NULL,
	"default_value" jsonb,
	"allowed_values" jsonb,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"operation" "history_operation" NOT NULL,
	"changed_by" text NOT NULL,
	"change_source" text NOT NULL,
	CONSTRAINT "attribute_definition_history_id_version_uq" UNIQUE("id","version")
);
--> statement-breakpoint
CREATE TABLE "attribute_definition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"requirement_type" text,
	"label" text NOT NULL,
	"data_type" "attribute_data_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"default_value" jsonb,
	"allowed_values" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "attribute_definition_key_type_uq" UNIQUE NULLS NOT DISTINCT("key","requirement_type")
);
--> statement-breakpoint
CREATE INDEX "attribute_definition_history_id_valid_from_idx" ON "attribute_definition_history" USING btree ("id","valid_from");--> statement-breakpoint
CREATE INDEX "attribute_definition_type_idx" ON "attribute_definition" USING btree ("requirement_type");