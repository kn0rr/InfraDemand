import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ATTRIBUT_DATENTYPEN, VORGABEWERT_SCHEMA } from "./attribute-definition.dto";

export class CreateAttributeDefinitionDto {
  @ApiProperty({
    example: "kostenstelle",
    maxLength: 100,
    description:
      "Schluessel im Feld dynamicAttributes. Kleinbuchstaben, Ziffern und Unterstrich - " +
      "der Wert wird zum JSON-Schluessel und zum Formularfeldnamen.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: "key muss mit einem Kleinbuchstaben beginnen und darf nur a-z, 0-9 und _ enthalten",
  })
  key!: string;

  @ApiPropertyOptional({
    example: "bestellung",
    maxLength: 100,
    description: "Ohne Angabe gilt die Definition fuer alle Anforderungstypen.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requirementType?: string;

  @ApiProperty({ example: "Kostenstelle", maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ enum: ATTRIBUT_DATENTYPEN, example: "text" })
  @IsIn([...ATTRIBUT_DATENTYPEN])
  dataType!: (typeof ATTRIBUT_DATENTYPEN)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    ...VORGABEWERT_SCHEMA,
    description: "Vorgabewert, dem Datentyp entsprechend.",
  })
  @IsOptional()
  defaultValue?: unknown;

  @ApiPropertyOptional({
    type: [String],
    description: "Pflicht bei enum und multi_enum, unzulaessig bei allen anderen Typen.",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  allowedValues?: string[];

  @ApiPropertyOptional({
    maxLength: 100,
    description: "Mandant, fuer den die Definition gilt. Ohne Angabe fuer alle (ADR-0026 Punkt 4).",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tenant?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      "Rollen, die dieses Attribut sehen duerfen. Ohne Angabe alle (§6, ADR-0030 Punkt 3).",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleFor?: string[];
}
