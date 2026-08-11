CREATE TYPE "public"."requirement_change_kind" AS ENUM('transition', 'state_assignment');--> statement-breakpoint
ALTER TABLE "requirement_history" ADD COLUMN "workflow_definition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement_history" ADD COLUMN "workflow_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement_history" ADD COLUMN "change_kind" "requirement_change_kind";--> statement-breakpoint
ALTER TABLE "requirement_history" ADD COLUMN "change_reason" text;--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "workflow_definition_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "workflow_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_workflow_definition_id_workflow_definition_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requirement_workflow_idx" ON "requirement" USING btree ("workflow_definition_id","workflow_version");