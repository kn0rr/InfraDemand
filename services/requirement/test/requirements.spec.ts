import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { requirements } from "../src/database/schema";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow, type TestWorkflow } from "./support/workflows";

describe("Anforderungen lesen", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let token: string;
  let workflow: TestWorkflow;

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    token = jwks.sign({ sub: "u1", preferred_username: "test.author" });
    pool = new Pool({ connectionString: database.connectionString });
    workflow = await registriereWorkflow(pool);
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
    await pool.query("TRUNCATE TABLE requirement CASCADE");
  });

  const get = () =>
    request(app.getHttpServer()).get("/v1/requirements").set("Authorization", `Bearer ${token}`);

  it("liefert eine leere Liste, wenn nichts gespeichert ist", async () => {
    const antwort = await get().expect(200);
    expect(antwort.body).toEqual([]);
  });

  it("liefert gespeicherte Anforderungen", async () => {
    const projektId = "11111111-1111-4111-8111-111111111111";

    await drizzle(pool)
      .insert(requirements)
      .values({
        workflowDefinitionId: workflow.id,
        workflowVersion: workflow.version,
        projectId: projektId,
        requirementType: "feature",
        status: "neu",
        owner: "test.author",
        dynamicAttributes: { kostenstelle: "K-4711" },
      });

    const antwort = await get().expect(200);

    expect(antwort.body).toHaveLength(1);
    expect(antwort.body[0]).toMatchObject({
      projectId: projektId,
      requirementType: "feature",
      status: "neu",
      owner: "test.author",
      dynamicAttributes: { kostenstelle: "K-4711" },
      version: 1,
    });
    expect(typeof antwort.body[0].id).toBe("string");
    expect(typeof antwort.body[0].createdAt).toBe("string");
  });

  it("gibt keine Datenbankspalten preis, die nicht zum Vertrag gehoeren", async () => {
    await drizzle(pool).insert(requirements).values({
      workflowDefinitionId: workflow.id,
      workflowVersion: workflow.version,
      projectId: "22222222-2222-4222-8222-222222222222",
      requirementType: "bug",
      status: "neu",
      owner: "test.author",
    });

    const antwort = await get().expect(200);

    expect(Object.keys(antwort.body[0]).sort()).toEqual([
      "createdAt",
      "dynamicAttributes",
      "externalId",
      "heldFields",
      "id",
      "owner",
      "projectId",
      "requirementType",
      "sourceSystem",
      "status",
      "updatedAt",
      "version",
    ]);
  });
});
