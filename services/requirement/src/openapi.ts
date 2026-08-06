import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

/**
 * Erzeugt das OpenAPI-Dokument. Genau eine Quelle fuer den laufenden Dienst und fuer den
 * Export nach docs/api - sonst weicht das eingecheckte Artefakt von dem ab, was der
 * Dienst tatsaechlich anbietet (ADR-0005).
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Requirement Service")
    .setDescription(
      "Anforderungen, Projekte und Lebenszyklus. Versionierter Contract nach " +
        "CLAUDE.md §12 - Aenderungen unterliegen der Kompatibilitaetspruefung.",
    )
    .setVersion("1")
    .setOpenAPIVersion("3.1.0")
    // Relativ statt absolut: Die Adresse ist umgebungsabhaengig, das eingecheckte
    // Artefakt darf keine Umgebung bevorzugen.
    .addServer("/", "Gleicher Ursprung wie dieses Dokument")
    .setLicense("Apache-2.0", "https://www.apache.org/licenses/LICENSE-2.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .build();

  return SwaggerModule.createDocument(app, config);
}
