import { Module } from "@nestjs/common";
import { OpaClient } from "./opa.client";

@Module({
  providers: [OpaClient],
  exports: [OpaClient],
})
export class BerechtigungModule {}
