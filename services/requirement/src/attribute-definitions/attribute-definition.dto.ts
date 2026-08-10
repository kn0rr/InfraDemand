import { ApiProperty, type ApiPropertyOptions } from "@nestjs/swagger";
import { attributeDataType } from "../database/schema";

/** Zulaessige Datentypen, abgeleitet aus dem Schema - eine Quelle, keine zweite Liste. */
export const ATTRIBUT_DATENTYPEN = attributeDataType.enumValues;

/**
 * Ein Vorgabewert richtet sich nach dem Datentyp des Attributs - Zeichenkette, Zahl,
 * Wahrheitswert oder Liste.
 *
 * Ohne diese Angabe faellt `@nestjs/swagger` auf `type: object` zurueck, und der erzeugte
 * Client verlangt ein Objekt. Ueber ihn liesse sich dann kein gueltiger Vorgabewert
 * setzen - der Contract behauptete etwas, das die Laufzeit gar nicht erwartet.
 */
export const VORGABEWERT_SCHEMA = {
  oneOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    { type: "array", items: { type: "string" } },
    // OpenAPI 3.1 kennt kein `nullable`. "Auch leer" ist ein eigener Zweig - und
    // beim Aendern zugleich der Weg, einen Vorgabewert wieder zu entfernen.
    { type: "null" },
  ],
} satisfies ApiPropertyOptions;

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
    ...VORGABEWERT_SCHEMA,
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
