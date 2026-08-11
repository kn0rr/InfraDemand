import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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

/**
 * `requirementType` fehlt bewusst - er bezeichnet, **wofuer** der Workflow gilt. Ihn zu
 * aendern naehme dem alten Typ seinen Graphen und gaebe dem neuen einen anderen, ohne
 * dass an einer der beiden Anforderungen etwas geschaehe, das auffiele.
 */
export class UpdateWorkflowDefinitionDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ enum: WORKFLOW_BETRIEBSARTEN })
  @IsIn([...WORKFLOW_BETRIEBSARTEN])
  mode!: (typeof WORKFLOW_BETRIEBSARTEN)[number];

  @ApiProperty({ maxLength: 100 })
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

  @ApiProperty({ type: [WorkflowTransitionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions!: WorkflowTransitionDto[];

  @ApiProperty({ description: "false setzt den Workflow ausser Kraft, ohne ihn zu loeschen." })
  @IsBoolean()
  active!: boolean;
}
