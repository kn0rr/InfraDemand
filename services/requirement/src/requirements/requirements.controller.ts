import { Controller, Get } from "@nestjs/common";

export interface Requirement {
  id: string;
  title: string;
}

@Controller("requirements")
export class RequirementsController {
  /**
   * Liefert vorerst eine leere Liste. Die Persistenz folgt in M1.3;
   * hier geht es ausschliesslich um den geschuetzten Zugriffspfad.
   */
  @Get()
  findAll(): Requirement[] {
    return [];
  }
}
