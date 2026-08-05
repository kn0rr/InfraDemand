import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { RequirementsModule } from "./requirements/requirements.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, HealthModule, RequirementsModule],
})
export class AppModule {}
