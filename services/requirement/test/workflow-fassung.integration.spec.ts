import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow, type TestWorkflow } from "./support/workflows";

describe("Gebundene Workflow-Fassung (ADR-0025)", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let alsMensch: string;
  let alsAdmin: string;

  const anlage = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    owner: "M. Weber",
    sourceSystem: "sap",
  };

  const STANDARDZUSTAENDE = [
    { key: "neu", label: "Neu" },
    { key: "in_pruefung", label: "In Pruefung" },
    { key: "erledigt", label: "Erledigt", final: true },
  ];

  const STANDARDUEBERGAENGE = [
    { from: "neu", to: "in_pruefung", label: "Einreichen" },
    { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
  ];

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    alsMensch = jwks.sign({ sub: "benutzer-1", azp: "frontend" });
    alsAdmin = jwks.sign({
      sub: "admin-1",
      azp: "frontend",
      realm_access: { roles: ["platform-admin"] },
    });

    pool = new Pool({ connectionString: database.connectionString });
    await registriereQuelle(pool, "sap", "automatic");

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
    await pool.query("TRUNCATE TABLE requirement, requirement_history CASCADE");
    await pool.query("TRUNCATE TABLE workflow_definition, workflow_definition_history CASCADE");
  });

  const mit = (token: string) => (methode: "post" | "patch" | "put" | "get", pfad: string) =>
    request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${token}`);

  async function anlegen(externalId: string) {
    const antwort = await mit(alsMensch)("post", "/v1/requirements")
      .send({ ...anlage, externalId })
      .expect(201);

    return antwort.body as {
      id: string;
      status: string;
      version: number;
      workflow: { id: string; version: number };
    };
  }

  /** Erzeugt eine neue Fassung ueber den Schreibpfad - samt Historienzeile. */
  async function neueFassung(
    workflow: TestWorkflow,
    teil: Record<string, unknown> = {},
  ): Promise<void> {
    await mit(alsAdmin)("put", `/v1/workflow-definitions/${workflow.id}`)
      .send({
        label: "Standardablauf",
        mode: "internal",
        initialState: "neu",
        states: STANDARDZUSTAENDE,
        transitions: STANDARDUEBERGAENGE,
        active: true,
        ...teil,
      })
      .expect(200);
  }

  const fassung = (externalId: string) =>
    `/v1/requirements/by-source/sap/${externalId}/workflow-version`;

  describe("Ausser Kraft gesetzter Workflow (Punkt 1)", () => {
    it("haelt laufende Anforderungen nicht an", async () => {
      const workflow = await registriereWorkflow(pool);
      await anlegen("A-1");

      await neueFassung(workflow, { active: false });

      // "Ausser Kraft gesetzt" heisst "keine neuen mehr", nicht "alles anhalten".
      await mit(alsMensch)("put", "/v1/requirements/by-source/sap/A-1/state")
        .send({ toState: "in_pruefung" })
        .expect(200);
    });

    it("laesst keine neuen Anforderungen mehr entstehen", async () => {
      const workflow = await registriereWorkflow(pool);
      await neueFassung(workflow, { active: false });

      await mit(alsMensch)("post", "/v1/requirements")
        .send({ ...anlage, externalId: "A-2" })
        .expect(400);
    });
  });

  describe("Heben (Punkt 4)", () => {
    it("hebt auf die aktuelle Fassung und weist den Vorgang aus", async () => {
      const workflow = await registriereWorkflow(pool);
      const angelegt = await anlegen("B-1");
      expect(angelegt.workflow.version).toBe(1);

      await neueFassung(workflow, { label: "Standardablauf (berichtigt)" });

      const gehoben = await mit(alsAdmin)("put", fassung("B-1"))
        .send({ reason: "Freigaberolle in Fassung 1 war falsch gesetzt" })
        .expect(200);

      expect(gehoben.body.workflow.version).toBe(2);

      const { rows } = await pool.query<{ change_kind: string; change_reason: string }>(
        "SELECT change_kind, change_reason FROM requirement_history ORDER BY version DESC LIMIT 1",
      );

      expect(rows[0]).toMatchObject({ change_kind: "version_upgrade" });
      expect(rows[0]?.change_reason).toContain("falsch gesetzt");
    });

    it("laesst den Zustand unberuehrt", async () => {
      const workflow = await registriereWorkflow(pool);
      await anlegen("B-2");

      await mit(alsMensch)("put", "/v1/requirements/by-source/sap/B-2/state")
        .send({ toState: "in_pruefung" })
        .expect(200);

      await neueFassung(workflow, { label: "Zweite Fassung" });

      const gehoben = await mit(alsAdmin)("put", fassung("B-2"))
        .send({ reason: "Auf den heutigen Stand gebracht" })
        .expect(200);

      // Gehoben wird die Fassung, nicht der Zustand (Punkt 5).
      expect(gehoben.body.status).toBe("in_pruefung");
    });

    it("erzeugt keine Version, wenn die Anforderung schon aktuell ist", async () => {
      await registriereWorkflow(pool);
      const angelegt = await anlegen("B-3");

      const antwort = await mit(alsAdmin)("put", fassung("B-3"))
        .send({ reason: "Vorsorglich angestossen, obwohl schon aktuell" })
        .expect(200);

      // §19.1: keine Version fuer eine Aenderung, die keine war.
      expect(antwort.body.version).toBe(angelegt.version);
    });

    it("weist ab, wenn der Zustand in der Zielfassung fehlt", async () => {
      const workflow = await registriereWorkflow(pool);
      await anlegen("B-4");

      await mit(alsMensch)("put", "/v1/requirements/by-source/sap/B-4/state")
        .send({ toState: "in_pruefung" })
        .expect(200);

      // Die neue Fassung kennt "in_pruefung" nicht mehr.
      await neueFassung(workflow, {
        states: [
          { key: "neu", label: "Neu" },
          { key: "erledigt", label: "Erledigt", final: true },
        ],
        transitions: [{ from: "neu", to: "erledigt", label: "Direkt abschliessen" }],
      });

      const antwort = await mit(alsAdmin)("put", fassung("B-4"))
        .send({ reason: "Versuch, auf die verkuerzte Fassung zu heben" })
        .expect(409);

      // Sonst behebt das Heben ein Problem und erzeugt dabei das aus ADR-0022 Punkt 5.
      expect(antwort.body.message).toContain("erst zuordnen");
    });

    it("weist ohne platform-admin ab", async () => {
      await registriereWorkflow(pool);
      await anlegen("B-5");

      await mit(alsMensch)("put", fassung("B-5"))
        .send({ reason: "Ohne Berechtigung versucht" })
        .expect(403);
    });

    it("verlangt eine Begruendung", async () => {
      await registriereWorkflow(pool);
      await anlegen("B-6");

      await mit(alsAdmin)("put", fassung("B-6")).send({ reason: "kurz" }).expect(400);
    });

    it("weist eine unbekannte Herkunft mit 404 ab", async () => {
      await registriereWorkflow(pool);

      await mit(alsAdmin)("put", fassung("gibt-es-nicht"))
        .send({ reason: "Datensatz existiert nicht" })
        .expect(404);
    });
  });

  describe("Auskunft ueber Fassungen in Gebrauch (Punkt 3)", () => {
    it("zaehlt je Fassung und kennzeichnet die aktuelle", async () => {
      const workflow = await registriereWorkflow(pool);
      await anlegen("C-1");
      await anlegen("C-2");

      await neueFassung(workflow, { label: "Zweite Fassung" });
      await anlegen("C-3");

      const antwort = await mit(alsAdmin)(
        "get",
        `/v1/workflow-definitions/${workflow.id}/usage`,
      ).expect(200);

      expect(antwort.body).toEqual([
        { version: 1, requirements: 2, current: false },
        { version: 2, requirements: 1, current: true },
      ]);
    });

    it("liefert eine leere Liste, wenn nichts darauf laeuft", async () => {
      const workflow = await registriereWorkflow(pool);

      const antwort = await mit(alsAdmin)(
        "get",
        `/v1/workflow-definitions/${workflow.id}/usage`,
      ).expect(200);

      expect(antwort.body).toEqual([]);
    });

    it("weist ohne platform-admin ab", async () => {
      const workflow = await registriereWorkflow(pool);

      await mit(alsMensch)("get", `/v1/workflow-definitions/${workflow.id}/usage`).expect(403);
    });

    it("weist eine unbekannte Kennung mit 404 ab", async () => {
      await mit(alsAdmin)(
        "get",
        "/v1/workflow-definitions/11111111-1111-4111-8111-111111111111/usage",
      ).expect(404);
    });
  });
});
