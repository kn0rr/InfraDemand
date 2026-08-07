import { Module } from "@nestjs/common";
import { SourceSystemsModule } from "../source-systems/source-systems.module";
import { RequirementsController } from "./requirements.controller";
import { RequirementsRepository } from "./requirements.repository";
import { RequirementsService } from "./requirements.service";

@Module({
  imports: [SourceSystemsModule],
  controllers: [RequirementsController],
  providers: [RequirementsService, RequirementsRepository],
})
export class RequirementsModule {}
