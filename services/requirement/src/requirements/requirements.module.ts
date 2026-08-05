import { Module } from "@nestjs/common";

import { RequirementsController } from "./requirements.controller";

@Module({
  controllers: [RequirementsController],
})
export class RequirementsModule {}
