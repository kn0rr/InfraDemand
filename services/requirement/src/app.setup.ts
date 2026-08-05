import { type INestApplication, VersioningType } from "@nestjs/common";

/**
 * Anwendungsweite Konfiguration, die sowohl der Prozessstart als auch die Tests
 * verwenden. Bewusst an einer Stelle: Wird die Versionierung nur in main.ts gesetzt,
 * testen die Integrationstests eine andere Anwendung als die, die ausgeliefert wird.
 */
export function configureApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
}
