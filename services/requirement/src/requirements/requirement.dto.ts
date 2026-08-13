import { ApiProperty } from "@nestjs/swagger";

export class RequirementWorkflowResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({
    type: "integer",
    example: 1,
    description:
      "Fassung, unter der diese Anforderung laeuft - nicht zwingend die aktuelle. " +
      "Eine Aenderung der Definition wirkt nicht rueckwirkend (§7).",
  })
  version!: number;
}

/**
 * API-Darstellung. Bewusst getrennt von der Datenbankzeile: Persistenzdetails duerfen
 * nicht in den Vertrag lecken (§2). Als Klasse statt Interface, weil der
 * OpenAPI-Contract daraus entsteht (ADR-0005).
 */
export class RequirementResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  projectId!: string;

  @ApiProperty({ example: "feature" })
  requirementType!: string;
  @ApiProperty({
    example: "t-eins",
    description:
      "Mandant, dem die Anforderung gehoert (§15). Er entscheidet, wer sie sehen und " +
      "aendern darf (ADR-0026).",
  })
  tenant!: string;

  @ApiProperty({
    type: RequirementWorkflowResponse,
    description: "Workflow und Fassung, gegen die Zustandswechsel geprueft werden.",
  })
  workflow!: RequirementWorkflowResponse;

  @ApiProperty({
    example: "neu",
    description:
      "Interner Status. Noch nicht das stabile Statusvokabular des Integrationsvertrags " +
      "nach CLAUDE.md §19.1 - die Abbildung folgt mit der Workflow-Engine in M4.",
  })
  status!: string;

  @ApiProperty()
  owner!: string;

  @ApiProperty({
    example: "infrademand",
    description: "Herkunftssystem des Datensatzes (§19.1). Eigene Erfassung: infrademand.",
  })
  sourceSystem!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Bezeichner im Herkunftssystem. Leer bei eigener Erfassung.",
  })
  externalId!: string | null;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description:
      "Dynamische Attribute nach §6. Das gueltige Schema je Anforderungstyp wird zur " +
      "Laufzeit ausgeliefert und ist hier bewusst nicht abgebildet.",
  })
  dynamicAttributes!: Record<string, unknown>;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ type: "integer", example: 1 })
  version!: number;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description:
      "Felder, die gegen automatische Uebernahme festgehalten sind (§19.3). Schluessel " +
      "ist der Feldname, Wert traegt `by`, `at` und `reason`.",
  })
  heldFields!: Record<string, { by: string; at: string; reason: string }>;
}
