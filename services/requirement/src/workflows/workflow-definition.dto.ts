import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { workflowMode } from "../database/schema";

import { Bedingung, VERGLEICHSOPERATOREN, WORKFLOW_BEDINGUNGSARTEN } from "./typen";

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

/** Ein Vergleich in `nurWenn` oder in einer `feldwert`-Bedingung (ADR-0024). */
export class VergleichDto {
  @ApiProperty({ example: "kostenschaetzung", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  feld!: string;

  @ApiProperty({ enum: VERGLEICHSOPERATOREN, example: "mindestens" })
  @IsIn([...VERGLEICHSOPERATOREN])
  operator!: (typeof VERGLEICHSOPERATOREN)[number];

  @ApiProperty({
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: {} },
      { type: "null" },
    ],
    description: "istEinesVon erwartet eine Liste, istGefuellt einen Wahrheitswert.",
  })
  // Der Wert ist Pflicht, aber jede Gestalt ist zulaessig - welche zum Operator passt,
  // entscheidet `pruefeGraph`. `@Allow()` haelt ihn durch die Rumpfpruefung: Ohne einen
  // class-validator-Dekorator gilt eine Eigenschaft als nicht zugelassen und wird mit
  // `forbidNonWhitelisted` abgewiesen. `@IsDefined()` waere zu streng - `wert: null` ist
  // ein gueltiger Vergleichswert.
  @Allow()
  wert!: unknown;
}

/**
 * Eine Bedingung an einem Uebergang (ADR-0024).
 *
 * **Flach statt als unterschiedene Typen.** Welche Felder zu welcher `art` gehoeren,
 * druecken die Dekoratoren nicht aus - das prueft `pruefeGraph` und kann dabei sagen, was
 * fehlt. Ein `oneOf` ueber sechs Klassen brauechte dieselbe Pruefung ein zweites Mal, in
 * einer Sprache, die keine brauchbare Meldung erzeugt.
 */
export class WorkflowBedingungDto {
  @ApiProperty({ enum: WORKFLOW_BEDINGUNGSARTEN })
  @IsIn([...WORKFLOW_BEDINGUNGSARTEN])
  art!: (typeof WORKFLOW_BEDINGUNGSARTEN)[number];

  @ApiPropertyOptional({ type: [String], description: "Bei art=rolle: eine davon genuegt." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eineVon?: string[];

  @ApiPropertyOptional({ description: "Bei art=vier_augen: Schluessel des Zustands." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  andersAlsBeiEintritt?: string;

  @ApiPropertyOptional({ description: "Bei art=identitaet und art=feldwert." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  feld?: string;

  @ApiPropertyOptional({ type: [String], description: "Bei art=pflichtfelder." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  felder?: string[];

  @ApiPropertyOptional({ enum: VERGLEICHSOPERATOREN, description: "Bei art=feldwert." })
  @IsOptional()
  @IsIn([...VERGLEICHSOPERATOREN])
  operator?: (typeof VERGLEICHSOPERATOREN)[number];

  @ApiPropertyOptional({
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: {} },
      { type: "null" },
    ],
    description: "Bei art=feldwert der Vergleichswert.",
  })
  @IsOptional()
  wert?: unknown;

  @ApiPropertyOptional({ type: "integer", minimum: 1, description: "Bei art=begruendung." })
  @IsOptional()
  @IsInt()
  @Min(1)
  mindestlaenge?: number;

  @ApiPropertyOptional({
    type: [VergleichDto],
    description: "Vorbehalt - alle Vergleiche muessen gelten, damit die Bedingung greift.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VergleichDto)
  nurWenn?: VergleichDto[];
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

  @ApiPropertyOptional({
    type: [WorkflowBedingungDto],
    description: "Alle muessen erfuellt sein. Ohne Angabe gibt es keine (ADR-0024).",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowBedingungDto)
  /**
   * Deklariert als Fachtyp, geprueft ueber `WorkflowBedingungDto`.
   *
   * Die beiden sagen absichtlich Verschiedenes: Der Dekorator prueft die **Gestalt** des
   * Rumpfs - Typen, Laengen, unbekannte Felder - und erzeugt das Contract-Schema. Ob die
   * Felder zur `art` passen, prueft `pruefeGraph` unmittelbar danach und kann dabei sagen,
   * was fehlt. Die Deklaration ist die Behauptung, die diese Pruefung einloest.
   */
  bedingungen?: Bedingung[];
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

export class WorkflowVersionUsageResponse {
  @ApiProperty({ type: "integer", example: 2 })
  version!: number;

  @ApiProperty({ type: "integer", example: 17, description: "Anforderungen auf dieser Fassung." })
  requirements!: number;

  @ApiProperty({
    description:
      "Ob dies die aktuelle Fassung ist. Alles andere laeuft auf einer aelteren - " +
      "gewollt nach §7, aber der Ort, an dem ein Heben zu erwaegen ist (ADR-0025).",
  })
  current!: boolean;
}
