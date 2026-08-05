import { Module } from "@nestjs/common";
import { RequirementsController } from "./requirements.controller";
import { RequirementsRepository } from "./requirements.repository";
import { RequirementsService } from "./requirements.service";

@Module({
  controllers: [RequirementsController],
  providers: [RequirementsService, RequirementsRepository],
})
export class RequirementsModule {}
