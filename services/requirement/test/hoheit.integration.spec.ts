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

describe("Datenhoheit im Schreibpfad", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  /** Client `sap`, in der Registratur als automatisch eingetragen. */
  let alsVorsystem: string;
  /** Client `frontend`, in der Registratur als manuell eingetragen. */
  let alsMensch: string;
  let alsAdmin: string;

  const basis = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    tenant: "t-eins",
  };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    // Die Klasse folgt aus dem Token, nicht aus dem Rumpf (ADR-0017 A4). Ein anderer
    // Client ist damit eine andere Quellenklasse - mehr braucht der Test nicht.
    alsVorsystem = jwks.sign({ sub: "dienst-1", azp: "sap", tenants: ["t-eins"] });
    alsMensch = jwks.sign({ sub: "benutzer-1", azp: "frontend", tenants: ["t-eins"] });
    alsAdmin = jwks.sign({
      sub: "admin-1",
      azp: "frontend",
      tenants: ["t-eins"],
      realm_access: { roles: ["platform-admin"] },
    });

    pool = new Pool({ connectionString: database.connectionString });
    await registriereQuelle(pool, "sap", "automatic");
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

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE TABLE requirement, requirement_history, mastership_rule, mastership_rule_history CASCADE",
    );
  });

  const mit = (token: string) => (methode: "post" | "patch" | "get", pfad: string) =>
    request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${token}`);

  async function importiere(externalId: string, owner: string) {
    return mit(alsVorsystem)("post", "/v1/requirements")
      .send({ ...basis, owner, sourceSystem: "sap", externalId })
      .expect(201);
  }

  async function regel(field: string, mode: string) {
    return mit(alsAdmin)("post", "/v1/mastership-rules").send({ field, mode }).expect(201);
  }

  describe("automatic_wins", () => {
    it("weist die manuelle Aenderung ab, wenn ein Vorsystem den Wert haelt", async () => {
      await importiere("A-1", "M. Weber");
      await regel("owner", "automatic_wins");

      const antwort = await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-1")
        .send({ owner: "T. Schmidt" })
        .expect(409);

      expect(antwort.body.fields).toEqual([
        { field: "owner", reason: "automatic_wins", message: expect.any(String) },
      ]);
    });

    it("laesst das Vorsystem weiterhin schreiben", async () => {
      await importiere("A-2", "M. Weber");
      await regel("owner", "automatic_wins");

      const antwort = await mit(alsVorsystem)("patch", "/v1/requirements/by-source/sap/A-2")
        .send({ owner: "L. Braun" })
        .expect(200);

      expect(antwort.body.owner).toBe("L. Braun");
    });

    it("laesst ein Feld ohne Regel von Hand aendern", async () => {
      await importiere("A-3", "M. Weber");
      await regel("owner", "automatic_wins");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-3")
        .send({ requirementType: "bug" })
        .expect(200);
    });

    it("speichert nichts, auch nicht die zulaessigen Felder", async () => {
      await importiere("A-4", "M. Weber");
      await regel("owner", "automatic_wins");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-4")
        .send({ owner: "T. Schmidt", requirementType: "bug" })
        .expect(409);

      const liste = await mit(alsAdmin)("get", "/v1/requirements").expect(200);

      // ADR-0019 Punkt 1: alles oder nichts.
      expect(liste.body[0]).toMatchObject({
        owner: "M. Weber",
        requirementType: "feature",
        version: 1,
      });
    });

    it("laesst den unveraenderten Wert durch", async () => {
      await importiere("A-5", "M. Weber");
      await regel("owner", "automatic_wins");

      // Ein Formular, das seine Felder vollstaendig zurueckschickt, darf nicht scheitern.
      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-5")
        .send({ owner: "M. Weber", requirementType: "bug" })
        .expect(200);
    });
  });

  describe("Aufzeichnung", () => {
    it("verzeichnet die abgewiesene Lieferung", async () => {
      const angelegt = await importiere("A-6", "M. Weber");
      await regel("owner", "automatic_wins");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-6")
        .send({ owner: "T. Schmidt" })
        .expect(409);

      const { rows } = await pool.query<{
        field: string;
        rejected_value: unknown;
        source_system: string;
        reason: string;
      }>(
        "SELECT field, rejected_value, source_system, reason FROM write_rejection WHERE requirement_id = $1",
        [angelegt.body.id],
      );

      expect(rows).toEqual([
        {
          field: "owner",
          rejected_value: "T. Schmidt",
          source_system: "frontend",
          reason: "automatic_wins",
        },
      ]);
    });
  });

  describe("manual_locked", () => {
    it("weist auch die Anlage von Hand ab", async () => {
      await regel("owner", "manual_locked");

      await mit(alsMensch)("post", "/v1/requirements")
        .send({ ...basis, owner: "T. Schmidt" })
        .expect(409);
    });

    it("laesst die Anlage durch ein Vorsystem zu", async () => {
      await regel("owner", "manual_locked");

      await importiere("A-7", "M. Weber");
    });
  });
});
