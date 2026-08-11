import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { pruefeVersionshistorie } from "./support/versionierung";
import { registriereWorkflow } from "./support/workflows";

describe("Zeitliche Zusicherung der Versionierung", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let adminToken: string;

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    adminToken = jwks.sign({
      sub: "admin-1",
      azp: "frontend",
      preferred_username: "test.admin",
      realm_access: { roles: ["platform-admin", "requirement-author"] },
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
  });

  const alsAdmin = (methode: "post" | "put" | "patch", pfad: string) =>
    request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${adminToken}`);

  it("haelt fuer jede versionierte Entitaet nach Anlage und Aenderung", async () => {
    // --- Attributdefinition: zwei Versionen ---
    const attribut = await alsAdmin("post", "/v1/attribute-definitions")
      .send({ key: "kostenstelle", label: "Kostenstelle", dataType: "text" })
      .expect(201);

    await alsAdmin("put", `/v1/attribute-definitions/${attribut.body.id}`)
      .send({ label: "Kostenstelle (neu)", dataType: "text", required: false, active: true })
      .expect(200);

    // --- Hoheitsregel: zwei Versionen ---
    const regel = await alsAdmin("post", "/v1/mastership-rules")
      .send({ field: "owner", mode: "manual_allowed" })
      .expect(201);

    await alsAdmin("put", `/v1/mastership-rules/${regel.body.id}`)
      .send({ mode: "automatic_wins" })
      .expect(200);

    // --- Anforderung: zwei Versionen ---
    await alsAdmin("post", "/v1/requirements")
      .send({
        projectId: "11111111-1111-4111-8111-111111111111",
        requirementType: "feature",

        owner: "test.admin",
        sourceSystem: "sap",
        externalId: "A-1",
      })
      .expect(201);

    await alsAdmin("put", "/v1/requirements/by-source/sap/A-1/state")
      .send({ toState: "in_pruefung" })
      .expect(200);

    // --- die Zusicherung, fuer alle drei gleich ---
    for (const [fach, historie] of [
      ["requirement", "requirement_history"],
      ["attribute_definition", "attribute_definition_history"],
      ["mastership_rule", "mastership_rule_history"],
      ["workflow_definition", "workflow_definition_history"],
    ] as const) {
      const verstoesse = await pruefeVersionshistorie(pool, fach, historie);
      expect(verstoesse, `${historie}: ${JSON.stringify(verstoesse)}`).toEqual([]);
    }
  });
});
