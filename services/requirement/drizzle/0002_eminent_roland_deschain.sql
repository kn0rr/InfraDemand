CREATE TYPE "public"."source_system_kind" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TABLE "source_system_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" "source_system_kind" NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"operation" "history_operation" NOT NULL,
	"changed_by" text NOT NULL,
	"change_source" text NOT NULL,
	CONSTRAINT "source_system_history_key_version_uq" UNIQUE("key","version")
);
--> statement-breakpoint
CREATE TABLE "source_system" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" "source_system_kind" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "source_system_history_key_valid_from_idx" ON "source_system_history" USING btree ("key","valid_from");--> statement-breakpoint
INSERT INTO "source_system" ("key", "label", "kind") VALUES ('infrademand', 'Eigene Erfassung', 'manual');--> statement-breakpoint
INSERT INTO "source_system_history" ("key", "label", "kind", "active", "created_at", "updated_at", "version", "valid_from", "operation", "changed_by", "change_source") SELECT "key", "label", "kind", "active", "created_at", "updated_at", 1, "created_at", 'insert', 'migration', 'infrademand' FROM "source_system" WHERE "key" = 'infrademand';--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_source_system_source_system_key_fk" FOREIGN KEY ("source_system") REFERENCES "public"."source_system"("key") ON DELETE no action ON UPDATE no action;
