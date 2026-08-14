import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AttributeDefinitionsModule } from "./attribute-definitions/attribute-definitions.module";
import { AuthModule } from "./auth/auth.module";
import { BerechtigungModule } from "./berechtigung/berechtigung.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { MastershipModule } from "./mastership/mastership.module";
import { RequirementsModule } from "./requirements/requirements.module";
import { WorkflowsModule } from "./workflows/workflows.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Tests lesen bewusst keine .env: Sonst maskiert eine lokal vorhandene Datei
      // fehlende Vorgaben, und der Fehler taucht erst in der CI auf.
      ignoreEnvFile: process.env["NODE_ENV"] === "test",
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    RequirementsModule,
    AttributeDefinitionsModule,
    MastershipModule,
    WorkflowsModule,
    BerechtigungModule,
  ],
})
export class AppModule {}
