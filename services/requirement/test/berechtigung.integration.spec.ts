import { ConfigService } from "@nestjs/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { asc } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import type { AuthenticatedUser } from "../src/auth/jwt.strategy";
import { OpaClient } from "../src/berechtigung/opa.client";
import { alsBedingung, FELDER_BESTAND } from "../src/berechtigung/ucast";
import { requirements } from "../src/database/schema";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestOpa, type TestOpa } from "./support/opa";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow } from "./support/workflows";

/**
 * Prueft den Weg Richtlinie → Bedingung → Abfrage unmittelbar gegen die Datenbank.
 *
 * Bis M5.2 verglich dieser Spec die erzeugte Bedingung mit `GET /v1/requirements`. Seit
 * die Richtlinie nach Eigentuemer zuschneidet (ADR-0029), laufen beide absichtlich
 * auseinander, und nach der Umstellung des Lesepfads waere der Vergleich ohnehin ein
 * Kreisschluss - der Endpunkt *ist* dann die Richtlinie. Geprueft wird deshalb gegen
 * ausgeschriebene Erwartungen; das ausgelieferte Verhalten prueft
 * `mandant.integration.spec.ts`.
 */
describe("Sichtbarkeit ueber die Richtlinie (M5.2)", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let opa: TestOpa;
  let pool: Pool;
  let db: NodePgDatabase;
  let client: OpaClient;

  const anlage = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    owner: "M. Weber",
  };

  const alsBenutzer = (
    tenants: string[],
    kennung: string,
    rollen: string[] = [],
    gruppen: string[] = [],
  ): AuthenticatedUser => ({
    userId: kennung,
    username: kennung,
    clientId: "frontend",
    roles: rollen,
    groups: gruppen,
    tenants,
  });

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    [database, opa] = await Promise.all([startTestDatabase(), startTestOpa()]);

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    pool = new Pool({ connectionString: database.connectionString });
    db = drizzle(pool);
    await registriereWorkflow(pool);

    client = new OpaClient(new ConfigService({ OPA_URL: opa.url }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Bestand ueber den echten Anlageweg, damit die Referenz nicht auf
    // Testvorbereitung beruht.
    for (const [tenant, owner, anzahl] of [
      ["t-eins", "anna", 2],
      ["t-zwei", "bodo", 3],
    ] as const) {
      const token = jwks.sign({
        sub: owner,
        azp: "frontend",
        preferred_username: owner,
        tenants: [tenant],
      });
      for (let i = 0; i < anzahl; i += 1) {
        await request(app.getHttpServer())
          .post("/v1/requirements")
          .set("Authorization", `Bearer ${token}`)
          .send({ ...anlage, tenant, owner })
          .expect(201);
      }
    }
  });
  afterAll(async () => {
    // Defensiv, damit ein Fehlschlag beim Hochfahren *eine* Meldung erzeugt und nicht
    // zwei - die zweite verdeckt sonst die erste.
    await app?.close();
    await pool?.end();
    await Promise.all([database?.stop(), opa?.stop()]);
  });

  /** Derselbe Bestand ueber die Richtlinie - der Kandidat. */
  async function ueberDieRichtlinie(benutzer: AuthenticatedUser): Promise<string[]> {
    const sichtbarkeit = await client.sichtbarkeit(benutzer);
    const zeilen = await db
      .select()
      .from(requirements)
      .where(alsBedingung(sichtbarkeit, FELDER_BESTAND))
      .orderBy(asc(requirements.createdAt));

    return zeilen.map((z) => z.id);
  }

  it("zeigt einem Anwender seine eigenen Anforderungen", async () => {
    expect(await ueberDieRichtlinie(alsBenutzer(["t-eins"], "anna"))).toHaveLength(2);
  });

  it("zeigt eine fremde Anforderung desselben Mandanten nicht", async () => {
    // Die eigentliche Korrektur aus ADR-0029: Mandantenzugehoerigkeit allein genuegt nicht.
    expect(await ueberDieRichtlinie(alsBenutzer(["t-eins"], "bodo"))).toEqual([]);
  });

  it("zeigt dem Betreiber den gesamten Mandanten", async () => {
    const sicht = await ueberDieRichtlinie(alsBenutzer(["t-eins"], "a.admin", ["platform-admin"]));

    // Zwei fremde Anforderungen - der Betreiber besitzt keine davon.
    expect(sicht).toHaveLength(2);
  });

  it("zeigt auch dem Betreiber keinen fremden Mandanten", async () => {
    const sicht = await ueberDieRichtlinie(alsBenutzer(["t-eins"], "a.admin", ["platform-admin"]));
    const alle = await ueberDieRichtlinie(
      alsBenutzer(["t-eins", "t-zwei"], "a.admin", ["platform-admin"]),
    );

    expect(sicht).toHaveLength(2);
    expect(alle).toHaveLength(5);
  });

  it("zeigt ohne Zugehoerigkeit nichts", async () => {
    // Hier antwortet die Auswertung mit einer leeren `in`-Liste, und ein nachlaessiger
    // Uebersetzer machte daraus „kein Filter".
    expect(await ueberDieRichtlinie(alsBenutzer([], "anna"))).toEqual([]);
  });

  it("die Auswertung laeuft gegen einen geschuetzten Server", async () => {
    // Belegt, dass die Freigabeliste aus authz.rego und der Pfad im Client
    // uebereinstimmen - sonst waere alles oben ein 503 gewesen.
    const fremd = await fetch(`${opa.url}/v1/policies`);

    expect(fremd.status).toBe(401);
  });
});
