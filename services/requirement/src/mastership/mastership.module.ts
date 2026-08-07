import { Module } from "@nestjs/common";
import { AttributeDefinitionsModule } from "../attribute-definitions/attribute-definitions.module";
import { MastershipController } from "./mastership.controller";
import { MastershipRepository } from "./mastership.repository";
import { MastershipService } from "./mastership.service";

@Module({
  imports: [AttributeDefinitionsModule],
  controllers: [MastershipController],
  providers: [MastershipService, MastershipRepository],
  exports: [MastershipService, MastershipRepository],
})
export class MastershipModule {}
