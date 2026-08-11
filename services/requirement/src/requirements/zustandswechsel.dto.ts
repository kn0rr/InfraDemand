import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Zustandswechsel (§7, ADR-0022 Punkt 1).
 *
 * Genannt wird der **Zielzustand**, nicht der Uebergang. Ein Fremdsystem kennt unseren
 * Graphen nicht, und ein Formular soll nicht zwei Angaben schicken muessen, von denen
 * eine aus der anderen folgt. Der passende Uebergang ist eindeutig, weil zwei Uebergaenge
 * zwischen demselben Zustandspaar bei der Graphpruefung abgewiesen werden.
 */
export class WechsleZustandDto {
  @ApiProperty({
    example: "in_pruefung",
    maxLength: 100,
    description: "Schluessel des Zielzustands aus dem geltenden Workflow.",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  toState!: string;
}

/**
 * Zuordnung eines Zustands (ADR-0022 Punkt 5).
 *
 * Fuer Anforderungen, deren aktueller Zustand im geltenden Workflow nicht vorkommt. Die
 * Begruendung ist Pflicht: Die Zuordnung setzt einen Zustand, den kein Uebergang hergibt,
 * und wer sie spaeter vorfindet, muss erkennen koennen, worauf sie beruhte - dieselbe
 * Ueberlegung wie bei der Festhaltung.
 */
export class OrdneZustandZuDto {
  @ApiProperty({ example: "in_pruefung", maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state!: string;

  @ApiProperty({
    example: "Bestand aus der Altablage, Zustand 'Freigegeben' entspricht 'in_pruefung'",
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
