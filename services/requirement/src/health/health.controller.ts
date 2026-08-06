import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../auth/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("Betrieb")
@Public()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Bereitschaftspruefung",
    description: "Unversioniert und ohne Token erreichbar - Ziel der Orchestrierungsschicht.",
  })
  @ApiResponse({
    status: 200,
    description: "Dienst ist bereit",
    schema: { type: "object", properties: { status: { type: "string", example: "ok" } } },
  })
  getHealth() {
    return this.healthService.getStatus();
  }
}
