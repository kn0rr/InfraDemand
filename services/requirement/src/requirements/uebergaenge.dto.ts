import { ApiProperty } from "@nestjs/swagger";
import { WORKFLOW_BEDINGUNGSARTEN } from "../workflows/typen";

export class BedingungsverstossResponse {
  @ApiProperty({ enum: WORKFLOW_BEDINGUNGSARTEN, example: "vier_augen" })
  kind!: (typeof WORKFLOW_BEDINGUNGSARTEN)[number];

  @ApiProperty({
    example:
      'Dieser Uebergang verlangt eine andere Person als die, die "in_pruefung" ausgeloest hat',
    description: "Fuer Menschen. Nicht zum Auswerten - der Wortlaut kann sich aendern.",
  })
  message!: string;
}

export class UebergangsoptionResponse {
  @ApiProperty({ example: "in_pruefung" })
  toState!: string;

  @ApiProperty({ example: "Einreichen" })
  label!: string;

  @ApiProperty({
    description: "Ob dieser Uebergang jetzt und von diesem Anwender genommen werden kann.",
  })
  allowed!: boolean;

  @ApiProperty({
    type: [BedingungsverstossResponse],
    description:
      "Leer, wenn zulaessig. Sonst jeder Grund einzeln, damit die Oberflaeche alle nennen kann.",
  })
  blockedBy!: BedingungsverstossResponse[];

  @ApiProperty({
    description:
      "Der Uebergang verlangt eine Begruendung. **Kein Hinderungsgrund** - sie wird beim " +
      "Ausloesen mitgegeben, nicht vorher erfuellt. Deshalb zaehlt sie nicht in `blockedBy`.",
  })
  requiresReason!: boolean;
}

export class UebergangsauskunftResponse {
  @ApiProperty({ example: "in_pruefung" })
  currentState!: string;

  @ApiProperty({
    description:
      "Ob der aktuelle Zustand im geltenden Graphen vorkommt. Bei `false` ist kein " +
      "Uebergang moeglich, bis ein Administrator ihn zuordnet (ADR-0022 Punkt 5) - die " +
      "Anforderung ist dann nicht fertig, sondern haengt.",
  })
  currentStateInWorkflow!: boolean;

  @ApiProperty({
    type: [UebergangsoptionResponse],
    description:
      "Alle Uebergaenge aus dem aktuellen Zustand, zulaessige wie gesperrte. Bei " +
      "fremdgefuehrten Workflows leer: Dort entscheidet das Fremdsystem (ADR-0021).",
  })
  transitions!: UebergangsoptionResponse[];
}
