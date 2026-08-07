import { Module } from "@nestjs/common";
import { SourceSystemsRepository } from "./source-systems.repository";
import { SourceSystemsService } from "./source-systems.service";

@Module({
  providers: [SourceSystemsService, SourceSystemsRepository],
  exports: [SourceSystemsService],
})
export class SourceSystemsModule {}
