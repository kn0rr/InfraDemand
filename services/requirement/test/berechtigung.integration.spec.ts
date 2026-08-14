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
import { alsBedingung } from "../src/berechtigung/ucast";
import { requirements } from "../src/database/schema";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestOpa, type TestOpa } from "./support/opa";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow } from "./support/workflows";

/**
 * Der Nachweis fuer M5.2 (ADR-0028 Punkt 4): Die aus der Richtlinie erzeugte Bedingung
 * liefert dieselbe Menge wie der handgeschriebene Filter aus M5.1.
 *
 * Die Referenz ist bewusst der Endpunkt und nicht eine nachgebaute Abfrage - verglichen
 * wird gegen das ausgelieferte Verhalten. Dass beide Seiten den leeren Fall
 * unterschiedlich loesen (Kurzschluss gegen `false`), ist der Grund, warum der Vergleich
 * ueberhaupt etwas aussagt.
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

  const alsBenutzer = (tenants: string[]): AuthenticatedUser => ({
    userId: "u-1",
    username: "test.author",
    clientId: "frontend",
    roles: [],
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
    for (const [tenant, anzahl] of [
      ["t-eins", 2],
      ["t-zwei", 3],
    ] as const) {
      const token = jwks.sign({ sub: "u-1", azp: "frontend", tenants: [tenant] });
      for (let i = 0; i < anzahl; i += 1) {
        await request(app.getHttpServer())
          .post("/v1/requirements")
          .set("Authorization", `Bearer ${token}`)
          .send({ ...anlage, tenant })
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

  /** Die ausgelieferte Antwort - die Referenz. */
  async function ueberDenEndpunkt(tenants: string[]): Promise<string[]> {
    const token = jwks.sign({ sub: "u-1", azp: "frontend", tenants });
    const antwort = await request(app.getHttpServer())
      .get("/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    return (antwort.body as { id: string }[]).map((e) => e.id);
  }

  /** Derselbe Bestand ueber die Richtlinie - der Kandidat. */
  async function ueberDieRichtlinie(tenants: string[]): Promise<string[]> {
    const sichtbarkeit = await client.sichtbarkeit(alsBenutzer(tenants));
    const zeilen = await db
      .select()
      .from(requirements)
      .where(alsBedingung(sichtbarkeit))
      .orderBy(asc(requirements.createdAt));

    return zeilen.map((z) => z.id);
  }

  it("liefert fuer einen Mandanten dieselbe Menge", async () => {
    const referenz = await ueberDenEndpunkt(["t-eins"]);

    expect(referenz).toHaveLength(2);
    expect(await ueberDieRichtlinie(["t-eins"])).toEqual(referenz);
  });

  it("liefert bei Mehrfachzugehoerigkeit dieselbe Menge", async () => {
    const referenz = await ueberDenEndpunkt(["t-eins", "t-zwei"]);

    // Damit der Vergleich oben nicht bloss zweimal „alles" ist.
    expect(referenz).toHaveLength(5);
    expect(await ueberDieRichtlinie(["t-eins", "t-zwei"])).toEqual(referenz);
  });

  it("liefert ohne Zugehoerigkeit beidseitig nichts", async () => {
    // Der gefaehrlichste Fall: Hier antwortet die Auswertung mit einer leeren
    // `in`-Liste, und ein nachlaessiger Uebersetzer wuerde daraus „kein Filter" machen.
    expect(await ueberDenEndpunkt([])).toEqual([]);
    expect(await ueberDieRichtlinie([])).toEqual([]);
  });

  it("liefert fuer einen Mandanten ohne Bestand beidseitig nichts", async () => {
    // Unterscheidet „Filter greift" von „es ist nichts gespeichert".
    expect(await ueberDenEndpunkt(["t-drei"])).toEqual([]);
    expect(await ueberDieRichtlinie(["t-drei"])).toEqual([]);
  });

  it("die Auswertung laeuft gegen einen geschuetzten Server", async () => {
    // Belegt, dass die Freigabeliste aus authz.rego und der Pfad im Client
    // uebereinstimmen - sonst waere alles oben ein 503 gewesen.
    const fremd = await fetch(`${opa.url}/v1/policies`);

    expect(fremd.status).toBe(401);
  });
});
