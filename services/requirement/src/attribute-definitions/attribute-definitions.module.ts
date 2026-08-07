import { Module } from "@nestjs/common";
import { AttributeDefinitionsController } from "./attribute-definitions.controller";
import { AttributeDefinitionsRepository } from "./attribute-definitions.repository";
import { AttributeDefinitionsService } from "./attribute-definitions.service";

@Module({
  controllers: [AttributeDefinitionsController],
  providers: [AttributeDefinitionsService, AttributeDefinitionsRepository],
  exports: [AttributeDefinitionsService],
})
export class AttributeDefinitionsModule {}
