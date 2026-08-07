import { Module } from "@nestjs/common";
import { AttributeDefinitionsModule } from "../attribute-definitions/attribute-definitions.module";
import { MastershipModule } from "../mastership/mastership.module";
import { SourceSystemsModule } from "../source-systems/source-systems.module";
import { RequirementsController } from "./requirements.controller";
import { RequirementsRepository } from "./requirements.repository";
import { RequirementsService } from "./requirements.service";

@Module({
  imports: [SourceSystemsModule, AttributeDefinitionsModule, MastershipModule],
  controllers: [RequirementsController],
  providers: [RequirementsService, RequirementsRepository],
})
export class RequirementsModule {}
