ALTER TABLE "attribute_definition" DROP CONSTRAINT "attribute_definition_key_type_uq";--> statement-breakpoint
ALTER TABLE "mastership_rule" DROP CONSTRAINT "mastership_rule_field_bindings_uq";--> statement-breakpoint
ALTER TABLE "workflow_definition" DROP CONSTRAINT "workflow_definition_requirement_type_uq";--> statement-breakpoint
DROP INDEX "attribute_definition_type_idx";--> statement-breakpoint
ALTER TABLE "attribute_definition_history" ADD COLUMN "tenant" text;--> statement-breakpoint
ALTER TABLE "attribute_definition" ADD COLUMN "tenant" text;--> statement-breakpoint
ALTER TABLE "mastership_rule_history" ADD COLUMN "tenant" text;--> statement-breakpoint
ALTER TABLE "mastership_rule" ADD COLUMN "tenant" text;--> statement-breakpoint
ALTER TABLE "requirement_history" ADD COLUMN "tenant" text NOT NULL;--> statement-breakpoint
ALTER TABLE "requirement" ADD COLUMN "tenant" text NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_definition_history" ADD COLUMN "tenant" text;--> statement-breakpoint
ALTER TABLE "workflow_definition" ADD COLUMN "tenant" text;--> statement-breakpoint
CREATE INDEX "attribute_definition_scope_idx" ON "attribute_definition" USING btree ("tenant","requirement_type");--> statement-breakpoint
CREATE INDEX "requirement_tenant_idx" ON "requirement" USING btree ("tenant");--> statement-breakpoint
ALTER TABLE "attribute_definition" ADD CONSTRAINT "attribute_definition_tenant_key_type_uq" UNIQUE NULLS NOT DISTINCT("tenant","key","requirement_type");--> statement-breakpoint
ALTER TABLE "mastership_rule" ADD CONSTRAINT "mastership_rule_tenant_field_bindings_uq" UNIQUE NULLS NOT DISTINCT("tenant","field","bindings");--> statement-breakpoint
ALTER TABLE "workflow_definition" ADD CONSTRAINT "workflow_definition_tenant_requirement_type_uq" UNIQUE NULLS NOT DISTINCT("tenant","requirement_type");