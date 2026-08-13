import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow } from "./support/workflows";

describe("Stichtagsabfrage", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let token: string;

  const gueltig = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    tenant: "t-eins",
    owner: "test.author",
  };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    token = jwks.sign({
      sub: "benutzer-1",
      azp: "frontend",
      preferred_username: "test.author",
      tenants: ["t-eins"],
    });
    pool = new Pool({ connectionString: database.connectionString });

    await registriereQuelle(pool, "sap");
    await registriereWorkflow(pool);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    configureApp(app);

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await database.stop();
    await jwks.close();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE requirement, requirement_history CASCADE");
  });

  const mitToken = () => `Bearer ${token}`;

  const anlegen = async (koerper: Record<string, unknown> = gueltig) =>
    (
      await request(app.getHttpServer())
        .post("/v1/requirements")
        .set("Authorization", mitToken())
        .send(koerper)
        .expect(201)
    ).body as { id: string; createdAt: string };

  const liste = (asOf?: string) => {
    const anfrage = request(app.getHttpServer())
      .get("/v1/requirements")
      .set("Authorization", mitToken());
    return asOf === undefined ? anfrage : anfrage.query({ asOf });
  };

  it("weist einen unlesbaren Stichtag ab", async () => {
    await liste("gestern").expect(400);
  });

  it("liefert vor der Anlage nichts", async () => {
    const angelegt = await anlegen();
    const davor = new Date(new Date(angelegt.createdAt).getTime() - 1000).toISOString();

    const antwort = await liste(davor).expect(200);
    expect(antwort.body).toEqual([]);
  });

  it("liefert nach der Anlage den Datensatz", async () => {
    const angelegt = await anlegen();
    const danach = new Date(new Date(angelegt.createdAt).getTime() + 1000).toISOString();

    const antwort = await liste(danach).expect(200);
    expect(antwort.body).toHaveLength(1);
    expect(antwort.body[0]).toMatchObject({ id: angelegt.id, status: "neu", version: 1 });
  });

  /**
   * Die wichtigste Pruefung: Sind Fachtabelle und Historie deckungsgleich? Weichen sie
   * ab, ist die Historie unvollstaendig - und damit der Nachweis wertlos, ohne dass
   * irgendetwas anderes rot wuerde.
   */
  it("Stichtag jetzt entspricht dem aktuellen Bestand", async () => {
    await anlegen();
    await anlegen({ ...gueltig, requirementType: "bug", sourceSystem: "sap", externalId: "A-1" });

    const aktuell = await liste().expect(200);
    const perStichtag = await liste(new Date().toISOString()).expect(200);

    expect(perStichtag.body).toEqual(aktuell.body);
  });

  it("liefert die Versionen eines Datensatzes", async () => {
    const angelegt = await anlegen();

    const antwort = await request(app.getHttpServer())
      .get(`/v1/requirements/${angelegt.id}/versions`)
      .set("Authorization", mitToken())
      .expect(200);

    expect(antwort.body).toHaveLength(1);
    expect(antwort.body[0]).toMatchObject({
      id: angelegt.id,
      version: 1,
      operation: "insert",
      validTo: null,
      changedBy: "benutzer-1",
      changeSource: "frontend",
    });
  });

  it("weist eine unlesbare Kennung bei der Versionsabfrage ab", async () => {
    await request(app.getHttpServer())
      .get("/v1/requirements/keine-uuid/versions")
      .set("Authorization", mitToken())
      .expect(400);
  });
});
