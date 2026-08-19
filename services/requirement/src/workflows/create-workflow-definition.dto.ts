import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  WORKFLOW_BETRIEBSARTEN,
  WorkflowStateDto,
  WorkflowTransitionDto,
} from "./workflow-definition.dto";

export class CreateWorkflowDefinitionDto {
  @ApiProperty({ example: "Standardablauf", maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional({
    example: "bestellung",
    maxLength: 100,
    description: "Ohne Angabe gilt der Workflow fuer alle Typen ohne eigenen.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requirementType?: string;
  @ApiPropertyOptional({
    maxLength: 100,
    description: "Mandant, fuer den der Workflow gilt. Ohne Angabe fuer alle (ADR-0026 Punkt 4).",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tenant?: string;

  @ApiPropertyOptional({ enum: WORKFLOW_BETRIEBSARTEN, default: "internal" })
  @IsOptional()
  @IsIn([...WORKFLOW_BETRIEBSARTEN])
  mode?: (typeof WORKFLOW_BETRIEBSARTEN)[number];

  @ApiProperty({ example: "neu", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  initialState!: string;

  @ApiProperty({ type: [WorkflowStateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStateDto)
  states!: WorkflowStateDto[];

  /**
   * Ohne Mindestgroesse: Ein fremdgefuehrter Workflow darf gar keine Uebergaenge fuehren
   * (ADR-0021 Punkt 5), und ein eigengefuehrter im Aufbau hat zunaechst einen Zustand
   * und noch keinen. Was zusammenpasst, entscheidet `pruefeGraph`, nicht der Validator.
   */
  @ApiProperty({ type: [WorkflowTransitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions!: WorkflowTransitionDto[];
}
