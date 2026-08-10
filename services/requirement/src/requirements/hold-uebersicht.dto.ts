import { ApiProperty } from "@nestjs/swagger";

export class AbgewieseneLieferung {
  @ApiProperty({ description: "Der zuletzt abgewiesene Wert." })
  value!: unknown;

  @ApiProperty({ example: "sap" })
  sourceSystem!: string;

  @ApiProperty({ format: "date-time" })
  occurredAt!: string;

  @ApiProperty({
    type: "integer",
    example: 47,
    description: "Wie oft eine Uebernahme dieses Feldes bisher abgewiesen wurde.",
  })
  count!: number;
}

/**
 * Ein festgehaltenes Feld (ADR-0017 B14).
 *
 * Die Zeile zeigt die Abweichung nicht nur als Zustand, sondern beziffert sie: was wir
 * halten, was das Herkunftssystem zuletzt liefern wollte, und seit wie vielen Laeufen.
 * Erst damit fuehrt eine Durchsicht zu einer Entscheidung statt zu einer Liste.
 */
export class FesthaltungUebersicht {
  @ApiProperty({ format: "uuid" })
  requirementId!: string;

  @ApiProperty({ example: "sap" })
  sourceSystem!: string;

  @ApiProperty({ type: String, nullable: true, example: "A-4711" })
  externalId!: string | null;

  @ApiProperty({ example: "owner" })
  field!: string;

  @ApiProperty({ description: "Der festgehaltene Wert." })
  heldValue!: unknown;

  @ApiProperty({ format: "date-time" })
  heldSince!: string;

  @ApiProperty()
  heldBy!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({
    type: AbgewieseneLieferung,
    nullable: true,
    description: "Leer, solange kein automatischer Lauf dieses Feld aendern wollte.",
  })
  lastRejection!: AbgewieseneLieferung | null;
}
