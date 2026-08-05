CREATE TABLE "requirement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"requirement_type" text NOT NULL,
	"status" text NOT NULL,
	"owner" text NOT NULL,
	"dynamic_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "requirement_project_idx" ON "requirement" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirement_status_idx" ON "requirement" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requirement_dynamic_attributes_idx" ON "requirement" USING gin ("dynamic_attributes");