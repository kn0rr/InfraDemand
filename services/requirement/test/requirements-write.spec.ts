import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { requirementHistory } from "../src/database/schema";
import { registriereAttribut } from "./support/attribute-definitions";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";

describe("Anforderungen anlegen", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let token: string;

  const gueltig = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    status: "neu",
    owner: "test.author",
  };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    token = jwks.sign({ sub: "benutzer-1", azp: "frontend", preferred_username: "test.author" });
    pool = new Pool({ connectionString: database.connectionString });

    await registriereQuelle(pool, "sap");
    await registriereAttribut(pool, { key: "kostenstelle", label: "Kostenstelle" });

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
    await pool.query("TRUNCATE TABLE requirement, requirement_history");
  });

  const post = () =>
    request(app.getHttpServer()).post("/v1/requirements").set("Authorization", `Bearer ${token}`);

  it("weist Anlage ohne Token ab", async () => {
    await request(app.getHttpServer()).post("/v1/requirements").send(gueltig).expect(401);
  });

  it("weist einen unvollstaendigen Rumpf ab", async () => {
    await post().send({ requirementType: "feature" }).expect(400);
  });

  it("weist eine ungueltige Projektkennung ab", async () => {
    await post()
      .send({ ...gueltig, projectId: "keine-uuid" })
      .expect(400);
  });

  it("weist unbekannte Felder ab, statt sie still zu verwerfen", async () => {
    await post()
      .send({ ...gueltig, unbekanntesFeld: "x" })
      .expect(400);
  });

  it("legt eine Anforderung an und liefert sie zurueck", async () => {
    const antwort = await post()
      .send({ ...gueltig, dynamicAttributes: { kostenstelle: "K-4711" } })
      .expect(201);

    expect(antwort.body).toMatchObject({
      projectId: gueltig.projectId,
      requirementType: "feature",
      status: "neu",
      owner: "test.author",
      sourceSystem: "infrademand",
      externalId: null,
      dynamicAttributes: { kostenstelle: "K-4711" },
      version: 1,
    });
  });

  it("schreibt genau eine Version in die Historie", async () => {
    const antwort = await post().send(gueltig).expect(201);
    const db = drizzle(pool);

    const versionen = await db
      .select()
      .from(requirementHistory)
      .where(eq(requirementHistory.id, antwort.body.id as string));

    expect(versionen).toHaveLength(1);
    expect(versionen[0]).toMatchObject({
      version: 1,
      operation: "insert",
      validTo: null,
      // Identitaet aus dem Token, nicht aus dem Rumpf
      changedBy: "benutzer-1",
      // Client aus dem Token - vom Aufrufer nicht faelschbar
      changeSource: "frontend",
    });
    expect(versionen[0]?.validFrom).toBeInstanceOf(Date);
  });

  it("uebernimmt eine fremde Herkunft aus dem Rumpf", async () => {
    const antwort = await post()
      .send({ ...gueltig, sourceSystem: "sap", externalId: "A-1" })
      .expect(201);

    expect(antwort.body).toMatchObject({ sourceSystem: "sap", externalId: "A-1" });
  });

  it("weist denselben Datensatz aus derselben Quelle mit 409 ab", async () => {
    const koerper = { ...gueltig, sourceSystem: "sap", externalId: "A-1" };

    await post().send(koerper).expect(201);
    await post().send(koerper).expect(409);
  });

  it("ist nach der Anlage ueber die Liste abrufbar", async () => {
    await post().send(gueltig).expect(201);

    const antwort = await request(app.getHttpServer())
      .get("/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(antwort.body).toHaveLength(1);
  });
  it("weist ein nicht eingetragenes Herkunftssystem ab", async () => {
    const antwort = await post()
      .send({ ...gueltig, sourceSystem: "nicht-registriert", externalId: "A-1" })
      .expect(400);

    expect(antwort.body.message).toContain("nicht-registriert");
  });

  it("nimmt ein eingetragenes Herkunftssystem an", async () => {
    const antwort = await post()
      .send({ ...gueltig, sourceSystem: "sap", externalId: "A-4711" })
      .expect(201);

    expect(antwort.body.sourceSystem).toBe("sap");
  });

  it("weist eine ausser Betrieb genommene Quelle ab", async () => {
    await registriereQuelle(pool, "altsystem", "automatic", false);

    await post()
      .send({ ...gueltig, sourceSystem: "altsystem", externalId: "A-9" })
      .expect(400);
  });

  describe("Dynamische Attribute", () => {
    it("weist ein nicht definiertes Attribut ab", async () => {
      const antwort = await post()
        .send({ ...gueltig, dynamicAttributes: { erfunden: "x" } })
        .expect(400);

      expect(antwort.body.attributes).toEqual([
        { key: "erfunden", message: expect.stringContaining("nicht definiert") },
      ]);
    });

    it("weist einen falschen Typ ab", async () => {
      await registriereAttribut(pool, { key: "aufwand", dataType: "number" });

      await post()
        .send({ ...gueltig, dynamicAttributes: { aufwand: "viel" } })
        .expect(400);
    });

    it("meldet alle beanstandeten Felder auf einmal", async () => {
      await registriereAttribut(pool, { key: "aufwand", dataType: "number" });

      const antwort = await post()
        .send({ ...gueltig, dynamicAttributes: { aufwand: "viel", erfunden: 1 } })
        .expect(400);

      expect(antwort.body.attributes).toHaveLength(2);
    });

    it("ergaenzt Vorgabewerte und entfernt leere optionale Attribute", async () => {
      await pool.query(
        "INSERT INTO attribute_definition (key, label, data_type, default_value) VALUES ('prio', 'Prio', 'text', '\"mittel\"') ON CONFLICT DO NOTHING",
      );

      const antwort = await post()
        .send({ ...gueltig, dynamicAttributes: { kostenstelle: "" } })
        .expect(201);

      expect(antwort.body.dynamicAttributes).toEqual({ prio: "mittel" });
    });
  });
});
