import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { registriereAttribut } from "./support/attribute-definitions";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestDatabase, type TestDatabase } from "./support/test-database";

describe("Hoheitsregeln", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let adminToken: string;
  let autorToken: string;

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    adminToken = jwks.sign({
      sub: "admin-1",
      azp: "frontend",
      tenants: ["t-eins"],
      realm_access: { roles: ["platform-admin"] },
    });
    autorToken = jwks.sign({
      sub: "benutzer-1",
      azp: "frontend",
      realm_access: { roles: ["requirement-author"] },
    });

    pool = new Pool({ connectionString: database.connectionString });

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
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE TABLE mastership_rule, mastership_rule_history, attribute_definition, attribute_definition_history",
    );
  });

  const anlegen = () =>
    request(app.getHttpServer())
      .post("/v1/mastership-rules")
      .set("Authorization", `Bearer ${adminToken}`);

  it("weist das Anlegen ohne platform-admin ab", async () => {
    await request(app.getHttpServer())
      .post("/v1/mastership-rules")
      .set("Authorization", `Bearer ${autorToken}`)
      .send({ field: "owner", mode: "automatic_wins" })
      .expect(403);
  });

  it("legt eine Regel fuer ein Kernfeld an", async () => {
    const antwort = await anlegen().send({ field: "owner", mode: "automatic_wins" }).expect(201);

    expect(antwort.body).toMatchObject({
      field: "owner",
      mode: "automatic_wins",
      bindings: {},
      version: 1,
    });
  });

  it("legt eine Regel fuer ein definiertes Attribut an", async () => {
    await registriereAttribut(pool, { key: "kostenstelle" });

    await anlegen().send({ field: "kostenstelle", mode: "manual_locked" }).expect(201);
  });

  it("weist ein Feld ab, das es weder als Kernfeld noch als Attribut gibt", async () => {
    await anlegen().send({ field: "gibtsnicht", mode: "automatic_wins" }).expect(400);
  });

  it("weist sourceSystem als Feld ab - es ist die Adresse, kein Fachwert", async () => {
    await anlegen().send({ field: "sourceSystem", mode: "automatic_wins" }).expect(400);
  });

  it("weist eine zweite Regel fuer dasselbe Feld mit 409 ab", async () => {
    await anlegen().send({ field: "owner", mode: "automatic_wins" }).expect(201);
    await anlegen().send({ field: "owner", mode: "manual_locked" }).expect(409);
  });

  it("erhoeht beim Aendern die Version und schreibt eine zweite Historienzeile", async () => {
    const angelegt = await anlegen().send({ field: "status", mode: "manual_allowed" }).expect(201);

    const geaendert = await request(app.getHttpServer())
      .put(`/v1/mastership-rules/${angelegt.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ mode: "automatic_wins" })
      .expect(200);

    expect(geaendert.body).toMatchObject({ mode: "automatic_wins", version: 2 });

    const versionen = await request(app.getHttpServer())
      .get(`/v1/mastership-rules/${angelegt.body.id}/versions`)
      .set("Authorization", `Bearer ${autorToken}`)
      .expect(200);

    expect(versionen.body).toHaveLength(2);
    expect(versionen.body[0]).toMatchObject({ mode: "manual_allowed", operation: "insert" });
    expect(versionen.body[1]).toMatchObject({ mode: "automatic_wins", validTo: null });
  });
  it("legt eine mandantenspezifische Regel an und gibt sie zurueck", async () => {
    const antwort = await anlegen()
      .send({ field: "owner", mode: "automatic_wins", tenant: "t-eins" })
      .expect(201);

    expect(antwort.body.tenant).toBe("t-eins");

    const { rows } = await pool.query<{ tenant: string }>(
      "SELECT tenant FROM mastership_rule WHERE field = 'owner'",
    );

    expect(rows[0]?.tenant).toBe("t-eins");
  });

  it("weist einen fremden Mandanten mit 403 ab", async () => {
    await anlegen().send({ field: "owner", mode: "automatic_wins", tenant: "t-drei" }).expect(403);
  });
});
