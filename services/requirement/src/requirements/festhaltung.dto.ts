import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Eine Festhaltung verlangt eine Begruendung (ADR-0017 B8).
 *
 * Sie erzeugt eine dauerhafte, gewollte Abweichung vom Herkunftssystem. Wer sie Monate
 * spaeter vorfindet, muss erkennen koennen, warum sie besteht - sonst bleibt nur, sie
 * aufzuheben und abzuwarten, was kaputtgeht. Die Angabe ist deshalb Pflicht und kein
 * Freitext von der Laenge null.
 */
export class SetzeFesthaltungDto {
  @ApiProperty({
    example: "Von SAP falsch gepflegt, Korrektur dort beantragt unter TICKET-4711",
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
