import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

/**
 * Teilweise Aenderung eines Datensatzes.
 *
 * **Ein fehlendes Feld bedeutet unveraendert, nicht leeren.** Ein ziehender Import
 * liefert nur, was er verwaltet; behandelte man Abwesenheit als Ersatz, verloere jede
 * Nacht alles, was eine andere Quelle pflegt.
 *
 * `sourceSystem` und `externalId` fehlen bewusst - sie sind die Adresse und stehen im
 * Pfad. Ein Wechsel der Herkunft ist ein anderer Datensatz.
 *
 * `status` fehlt seit ADR-0022 - der Zustandswechsel ist ein eigener Vorgang und laeuft
 * gegen den Zustandsgraphen. Er hier zuzulassen hiesse, ihn am Graphen vorbei zu setzen.
 */
export class PatchRequirementDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: "feature", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  requirementType?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  owner?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description:
      "Wird schluesselweise mit dem Bestand zusammengefuehrt. Ein nicht genannter " +
      "Schluessel bleibt unveraendert; `null` loescht ihn.",
  })
  @IsOptional()
  @IsObject()
  dynamicAttributes?: Record<string, unknown>;
}
