import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ATTRIBUT_DATENTYPEN, VORGABEWERT_SCHEMA } from "./attribute-definition.dto";

/**
 * `key` und `requirementType` fehlen bewusst - sie bezeichnen die Definition. Ein
 * geaenderter Schluessel liesse alle bereits gespeicherten Werte unter dem alten
 * Schluessel ohne Definition zurueck, ohne dass es irgendwo auffiele.
 */
export class UpdateAttributeDefinitionDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ enum: ATTRIBUT_DATENTYPEN })
  @IsIn([...ATTRIBUT_DATENTYPEN])
  dataType!: (typeof ATTRIBUT_DATENTYPEN)[number];

  @ApiProperty()
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  allowedValues?: string[];

  @ApiProperty({ description: "false setzt die Definition ausser Kraft, ohne sie zu loeschen." })
  @IsBoolean()
  active!: boolean;

  @ApiPropertyOptional({
    ...VORGABEWERT_SCHEMA,
    description: "Vorgabewert, dem Datentyp entsprechend.",
  })
  @IsOptional()
  defaultValue?: unknown;
}
