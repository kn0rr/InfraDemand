import { ApiProperty } from "@nestjs/swagger";
import { RequirementResponse } from "./requirement.dto";

/**
 * Eine Version samt Zeitraum und Herkunft der Aenderung. Aus dem Vergleich
 * aufeinanderfolgender Versionen ergeben sich alter Wert, neuer Wert und die feldgenaue
 * Herkunft - damit ist §16 ohne zweiten Speicher erfuellt (ADR-0011, ADR-0012).
 */
export class RequirementVersionResponse extends RequirementResponse {
  @ApiProperty({ format: "date-time" })
  validFrom!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
    description: "Leer bei der aktuell gueltigen Version.",
  })
  validTo!: string | null;

  @ApiProperty({ enum: ["insert", "update", "delete"] })
  operation!: "insert" | "update" | "delete";

  @ApiProperty({ description: "Ausloesende Identitaet." })
  changedBy!: string;

  @ApiProperty({ description: "Client, der die Aenderung ausgefuehrt hat - aus dem Token." })
  changeSource!: string;
}
