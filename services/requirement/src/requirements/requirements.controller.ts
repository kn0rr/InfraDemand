import { Controller, Get } from "@nestjs/common";
import type { RequirementResponse } from "./requirement.dto";
import { RequirementsService } from "./requirements.service";

@Controller("requirements")
export class RequirementsController {
  constructor(private readonly service: RequirementsService) {}

  @Get()
  findAll(): Promise<RequirementResponse[]> {
    return this.service.findAll();
  }
}
