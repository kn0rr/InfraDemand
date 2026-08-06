import { IsISO8601, IsOptional } from "class-validator";

export class ListRequirementsQuery {
  /**
   * Stichtag. Ohne Angabe wird der aktuelle Bestand geliefert, mit Angabe der Zustand,
   * den das System zu diesem Zeitpunkt kannte (ADR-0012).
   */
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}
