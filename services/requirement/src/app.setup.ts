import { type INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";

/**
 * Anwendungsweite Konfiguration, die Prozessstart, Tests und Contract-Export gemeinsam
 * verwenden. Bewusst an einer Stelle: Weicht eine davon ab, beschreibt der Contract eine
 * andere Anwendung als die ausgelieferte.
 *
 * Die Auslieferung der Weboberflaeche gehoert **nicht** hierher - sie wird nur vom
 * laufenden Dienst gebraucht, nicht vom Export und nicht von den Tests.
 */
export function configureApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Unbekannte Felder werden abgewiesen, nicht still verworfen: Der Aufrufer glaubt
      // sonst, sein Wert sei uebernommen worden.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
