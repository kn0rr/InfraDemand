import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { RequirementsModule } from "./requirements/requirements.module";

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
  ],
})
export class AppModule {}
