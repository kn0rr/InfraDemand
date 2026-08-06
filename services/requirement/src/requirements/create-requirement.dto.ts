import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateRequirementDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  projectId!: string;

  @ApiProperty({ example: "feature", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  requirementType!: string;

  @ApiProperty({
    example: "neu",
    maxLength: 100,
    description:
      "Kein Vorgabewert: Ein fest verdrahteter Anfangszustand waere eine Workflow-Annahme, " +
      "und §7 macht Zustaende konfigurierbar. Ab M4 liefert ihn die Workflow-Definition.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  status!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  owner!: string;

  @ApiPropertyOptional({
    example: "sap",
    maxLength: 100,
    description: "Herkunft der Daten (§19.1). Ohne Angabe: eigene Erfassung.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceSystem?: string;

  @ApiPropertyOptional({
    example: "A-4711",
    maxLength: 200,
    description:
      "Bezeichner im Herkunftssystem. Zusammen mit sourceSystem eindeutig - eine " +
      "Wiederholung wird mit 409 abgewiesen (Idempotenz nach §19.1).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  dynamicAttributes?: Record<string, unknown>;
}
