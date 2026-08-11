import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { workflowMode } from "../database/schema";

/** Zulaessige Betriebsarten, abgeleitet aus dem Schema - eine Quelle, keine zweite Liste. */
export const WORKFLOW_BETRIEBSARTEN = workflowMode.enumValues;

const ZUSTANDSSCHLUESSEL = /^[a-z][a-z0-9_]*$/;

export class WorkflowStateDto {
  @ApiProperty({ example: "in_pruefung", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(ZUSTANDSSCHLUESSEL, {
    message: "key muss mit einem Kleinbuchstaben beginnen und darf nur a-z, 0-9 und _ enthalten",
  })
  key!: string;

  @ApiProperty({ example: "In Pruefung", maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({
    default: false,
    description: "Endzustand - von hier fuehrt kein Uebergang weiter.",
  })
  @IsOptional()
  @IsBoolean()
  final?: boolean;
}

export class WorkflowTransitionDto {
  @ApiProperty({ example: "neu", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  from!: string;

  @ApiProperty({ example: "in_pruefung", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  to!: string;

  @ApiProperty({ example: "Einreichen", maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;
}

export class WorkflowStateResponse {
  @ApiProperty({ example: "in_pruefung" })
  key!: string;

  @ApiProperty({ example: "In Pruefung" })
  label!: string;

  /** Immer gesetzt, auch wenn beim Anlegen weggelassen - der Aufrufer muss nicht auf
   *  "fehlt" und "false" zugleich pruefen. */
  @ApiProperty()
  final!: boolean;
}

export class WorkflowTransitionResponse {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty()
  label!: string;
}

export class WorkflowDefinitionResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "Standardablauf" })
  label!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Anforderungstyp, fuer den der Workflow gilt. Leer bedeutet: fuer alle uebrigen.",
  })
  requirementType!: string | null;

  @ApiProperty({
    enum: WORKFLOW_BETRIEBSARTEN,
    description:
      "internal: Uebergaenge werden hier geprueft und abgewiesen. external: Ein " +
      "Fremdsystem fuehrt den Vorgang, der Graph beschreibt ihn nur (ADR-0021).",
  })
  mode!: (typeof WORKFLOW_BETRIEBSARTEN)[number];

  @ApiProperty({ example: "neu" })
  initialState!: string;

  @ApiProperty({ type: [WorkflowStateResponse] })
  states!: WorkflowStateResponse[];

  @ApiProperty({ type: [WorkflowTransitionResponse] })
  transitions!: WorkflowTransitionResponse[];

  @ApiProperty({
    type: [String],
    description:
      "Zustaende, die vom Anfangszustand aus nicht erreichbar sind. Kein Fehler - ein " +
      "Graph im Aufbau ist unvollstaendig, nicht falsch -, aber ein Hinweis fuer die " +
      "Verwaltungsoberflaeche.",
  })
  unreachableStates!: string[];

  @ApiProperty({
    description: "false setzt den Workflow ausser Kraft, ohne ihn zu loeschen.",
  })
  active!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ type: "integer", example: 1 })
  version!: number;
}

export class WorkflowDefinitionVersionResponse extends WorkflowDefinitionResponse {
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
