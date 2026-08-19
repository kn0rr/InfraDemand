import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { mastershipMode } from "../database/schema";

/** Zulaessige Regelwerte, abgeleitet aus dem Schema - eine Quelle, keine zweite Liste. */
export const HOHEITSMODI = mastershipMode.enumValues;

/**
 * Kernfelder, fuer die eine Hoheitsregel gelten kann.
 *
 * `sourceSystem` und `externalId` fehlen bewusst: Sie sind die Adresse des Datensatzes
 * ueber die Servicegrenze (ADR-0010) und keine fachlichen Werte, um die zwei Quellen
 * streiten koennten.
 */
export const REGELBARE_KERNFELDER = [
  "projectId",
  "requirementType",
  "status",
  "owner",
  "responsibleGroup",
] as const;

export class MastershipRuleResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({
    example: "owner",
    description: "Kernfeld oder Schluessel eines dynamischen Attributs.",
  })
  field!: string;

  @ApiProperty({
    enum: HOHEITSMODI,
    example: "automatic_wins",
    description:
      "manual_allowed: jede berechtigte Quelle schreibt, die letzte gewinnt. " +
      "automatic_wins: manuelle Aenderung wird abgewiesen, solange eine automatische " +
      "Quelle das Feld bespielt. manual_locked: manuelle Aenderung ist immer verboten.",
  })
  mode!: (typeof HOHEITSMODI)[number];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Mandant, fuer den die Regel gilt. Leer heisst: fuer alle.",
  })
  tenant!: string | null;

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "string" },
    description:
      "Geltungsbereich nach ADR-0017 A6. Vorerst immer leer - eine Regel gilt fuer alle " +
      "Anforderungen.",
  })
  bindings!: Record<string, string>;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ type: "integer", example: 1 })
  version!: number;
}

export class MastershipRuleVersionResponse extends MastershipRuleResponse {
  @ApiProperty({ format: "date-time" })
  validFrom!: string;

  @ApiProperty({ type: String, format: "date-time", nullable: true })
  validTo!: string | null;

  @ApiProperty({ enum: ["insert", "update", "delete"] })
  operation!: "insert" | "update" | "delete";

  @ApiProperty()
  changedBy!: string;

  @ApiProperty()
  changeSource!: string;
}

export class CreateMastershipRuleDto {
  @ApiProperty({ example: "owner", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  field!: string;

  @ApiProperty({ enum: HOHEITSMODI })
  @IsIn([...HOHEITSMODI])
  mode!: (typeof HOHEITSMODI)[number];

  @ApiPropertyOptional({
    maxLength: 100,
    description: "Mandant, fuer den die Regel gilt. Ohne Angabe fuer alle (ADR-0026 Punkt 4).",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tenant?: string;
}

/** `field` fehlt: Es bezeichnet die Regel. Ein anderes Feld ist eine andere Regel. */
export class UpdateMastershipRuleDto {
  @ApiProperty({ enum: HOHEITSMODI })
  @IsIn([...HOHEITSMODI])
  mode!: (typeof HOHEITSMODI)[number];
}
