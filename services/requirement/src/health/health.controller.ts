import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";

import { Public } from "../auth/public.decorator";
import { HealthService } from "./health.service";

@Public()
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getStatus();
  }
}
