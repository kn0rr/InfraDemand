import { ApiProperty } from "@nestjs/swagger";
import { attributeDataType } from "../database/schema";

/** Zulaessige Datentypen, abgeleitet aus dem Schema - eine Quelle, keine zweite Liste. */
export const ATTRIBUT_DATENTYPEN = attributeDataType.enumValues;

export class AttributeDefinitionResponse {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "kostenstelle" })
  key!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Anforderungstyp, fuer den die Definition gilt. Leer bedeutet: fuer alle.",
  })
  requirementType!: string | null;

  @ApiProperty({ example: "Kostenstelle" })
  label!: string;

  @ApiProperty({ enum: ATTRIBUT_DATENTYPEN, example: "text" })
  dataType!: (typeof ATTRIBUT_DATENTYPEN)[number];

  @ApiProperty()
  required!: boolean;

  @ApiProperty({
    nullable: true,
    description: "Vorgabewert, dem Datentyp entsprechend.",
  })
  defaultValue!: unknown;

  @ApiProperty({
    type: [String],
    nullable: true,
    description: "Zulaessige Werte bei enum und multi_enum, sonst leer.",
  })
  allowedValues!: string[] | null;

  @ApiProperty({
    description:
      "Ausser Kraft gesetzte Definitionen bleiben bestehen - bestehende Anforderungen " +
      "tragen Werte, die nur mit ihnen deutbar sind.",
  })
  active!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ type: "integer", example: 1 })
  version!: number;
}

export class AttributeDefinitionVersionResponse extends AttributeDefinitionResponse {
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
