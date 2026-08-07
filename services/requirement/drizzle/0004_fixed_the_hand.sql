CREATE TYPE "public"."mastership_mode" AS ENUM('manual_allowed', 'automatic_wins', 'manual_locked');--> statement-breakpoint
CREATE TABLE "mastership_rule_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" uuid NOT NULL,
	"field" text NOT NULL,
	"mode" "mastership_mode" NOT NULL,
	"bindings" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"operation" "history_operation" NOT NULL,
	"changed_by" text NOT NULL,
	"change_source" text NOT NULL,
	CONSTRAINT "mastership_rule_history_id_version_uq" UNIQUE("id","version")
);
--> statement-breakpoint
CREATE TABLE "mastership_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field" text NOT NULL,
	"mode" "mastership_mode" NOT NULL,
	"bindings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "mastership_rule_field_bindings_uq" UNIQUE("field","bindings")
);
--> statement-breakpoint
CREATE INDEX "mastership_rule_history_id_valid_from_idx" ON "mastership_rule_history" USING btree ("id","valid_from");