import "reflect-metadata";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { dump } from "js-yaml";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { createOpenApiDocument } from "./openapi";

const ZIEL = resolve(process.cwd(), "../../docs/api/requirement.openapi.yaml");

/**
 * OpenAPI 3.1 kennt kein "nullable" mehr - dort gehoert der Nulltyp in die Typangabe.
 * @nestjs/swagger erzeugt weiterhin die 3.0-Form, auch wenn das Dokument als 3.1
 * ausgewiesen ist. Ohne diese Umschreibung entsteht formal ungueltiges 3.1, und ein
 * generierter Client behandelt nullbare Felder als immer gefuellt.
 *
 * Bewusst zentral im Export statt je Feld: Was hier steht, gilt fuer jedes kuenftige DTO.
 */
function nullableNach31(knoten: unknown): void {
  if (Array.isArray(knoten)) {
    for (const eintrag of knoten) {
      nullableNach31(eintrag);
    }
    return;
  }

  if (typeof knoten !== "object" || knoten === null) {
    return;
  }

  const objekt = knoten as Record<string, unknown>;

  if (objekt["nullable"] === true && typeof objekt["type"] === "string") {
    objekt["type"] = [objekt["type"], "null"];
    delete objekt["nullable"];
  }

  for (const wert of Object.values(objekt)) {
    nullableNach31(wert);
  }
}

/**
 * Ein Vorgang ohne Sicherheitsangabe ist mehrdeutig: Er kann eine Vorgabe von oberster
 * Ebene erben oder gar keine benoetigen. Eine ausdrueckliche leere Liste sagt
 * unmissverstaendlich "keine erforderlich" - und bleibt richtig, falls spaeter eine
 * Vorgabe auf oberster Ebene dazukommt.
 */
function offeneVorgaengeKennzeichnen(dokument: Record<string, unknown>): void {
  const pfade = dokument["paths"] as Record<string, Record<string, unknown>> | undefined;
  if (!pfade) {
    return;
  }

  for (const vorgaenge of Object.values(pfade)) {
    for (const [verb, vorgang] of Object.entries(vorgaenge)) {
      if (!["get", "post", "put", "patch", "delete"].includes(verb)) {
        continue;
      }
      const eintrag = vorgang as Record<string, unknown>;
      if (eintrag["security"] === undefined) {
        eintrag["security"] = [];
      }
    }
  }
}

async function exportieren(): Promise<void> {
  // Aufgebaut, aber nicht gestartet: Es wird nur die Routentabelle gebraucht, keine
  // Verbindung zu Datenbank oder Keycloak. Der Adapter muss trotzdem derselbe sein wie
  // im Betrieb - sonst beschreibt der Contract eine andere Anwendung.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  configureApp(app);
  await app.init();

  const dokument = createOpenApiDocument(app);
  nullableNach31(dokument);
  offeneVorgaengeKennzeichnen(dokument as unknown as Record<string, unknown>);

  // sortKeys erzwingt eine stabile Reihenfolge. Ohne sie erzeugt jeder Lauf ein anderes
  // Ergebnis, und das Drift-Tor schlaegt falsch an (ADR-0005).
  writeFileSync(ZIEL, dump(dokument, { sortKeys: true, lineWidth: 100, noRefs: true }), "utf8");

  await app.close();
  process.stdout.write(`OpenAPI geschrieben: ${ZIEL}\n`);
}

exportieren().catch((fehler: unknown) => {
  process.stderr.write(`${String(fehler)}\n`);
  process.exit(1);
});
