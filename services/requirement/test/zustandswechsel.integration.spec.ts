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

describe("Zustandswechsel", () => {
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

    return antwort.body as { id: string; status: string; version: number };
  }

  const zustand = (externalId: string) => `/v1/requirements/by-source/sap/${externalId}/state`;

  describe("Pflicht zum Workflow (ADR-0022 Punkt 2)", () => {
    it("weist das Anlegen ohne Workflow ab", async () => {
      const antwort = await mit(alsMensch)("post", "/v1/requirements")
        .send({ ...anlage, externalId: "A-0" })
        .expect(400);

      expect(antwort.body.message).toContain("Workflow");
    });

    it("nimmt den Anfangszustand aus der Definition", async () => {
      await registriereWorkflow(pool);

      const angelegt = await anlegen("A-1");

      // Nicht aus dem Rumpf - der kennt kein `status` mehr.
      expect(angelegt.status).toBe("neu");
    });

    it("weist einen Rumpf mit status ab, statt ihn zu verwerfen", async () => {
      await registriereWorkflow(pool);

      // Stillschweigend verwerfen waere schlimmer: Der Aufrufer haelte den Wert fuer
      // uebernommen.
      await mit(alsMensch)("post", "/v1/requirements")
        .send({ ...anlage, externalId: "A-2", status: "erledigt" })
        .expect(400);
    });

    it("weist status im PATCH ab", async () => {
      await registriereWorkflow(pool);
      await anlegen("A-3");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/A-3")
        .send({ status: "erledigt" })
        .expect(400);
    });
  });

  describe("Uebergang", () => {
    beforeEach(async () => {
      await registriereWorkflow(pool);
    });

    it("wechselt entlang eines Uebergangs", async () => {
      await anlegen("B-1");

      const antwort = await mit(alsMensch)("put", zustand("B-1"))
        .send({ toState: "in_pruefung" })
        .expect(200);

      expect(antwort.body).toMatchObject({ status: "in_pruefung", version: 2 });
    });

    it("weist einen Zustand ab, den es im Graphen nicht gibt", async () => {
      await anlegen("B-2");

      await mit(alsMensch)("put", zustand("B-2")).send({ toState: "erfunden" }).expect(400);
    });

    it("weist einen Sprung ohne Uebergang mit 409 ab", async () => {
      await anlegen("B-3");

      // neu -> erledigt gibt es nicht; der Weg fuehrt ueber in_pruefung.
      const antwort = await mit(alsMensch)("put", zustand("B-3"))
        .send({ toState: "erledigt" })
        .expect(409);

      expect(antwort.body.message).toContain("kein Uebergang");
    });

    it("erzeugt bei demselben Zustand keine zweite Version", async () => {
      await anlegen("B-4");
      await mit(alsMensch)("put", zustand("B-4")).send({ toState: "in_pruefung" }).expect(200);

      const nochmal = await mit(alsMensch)("put", zustand("B-4"))
        .send({ toState: "in_pruefung" })
        .expect(200);

      // §19.1: Ein Import liefert den Zustand bei jedem Lauf mit. Jede Wiederholung als
      // Aenderung zu verzeichnen fuellte die Historie mit Nichtereignissen.
      expect(nochmal.body.version).toBe(2);
    });

    it("weist den Vorgang als Uebergang aus", async () => {
      await anlegen("B-5");
      await mit(alsMensch)("put", zustand("B-5")).send({ toState: "in_pruefung" }).expect(200);

      const { rows } = await pool.query<{ change_kind: string | null }>(
        "SELECT change_kind FROM requirement_history ORDER BY version",
      );

      expect(rows.map((zeile) => zeile.change_kind)).toEqual([null, "transition"]);
    });
  });

  describe("Unbekannter Ausgangszustand (ADR-0022 Punkt 5)", () => {
    beforeEach(async () => {
      await registriereWorkflow(pool);
    });

    /**
     * Setzt den Zustand an der API vorbei - genau die Lage, die entsteht, wenn eine
     * Anforderung aelter ist als ihr Workflow oder ein Import einen fremden Status
     * geliefert hat. Ueber die Schnittstelle ist sie nicht mehr herstellbar.
     */
    async function fremderZustand(externalId: string) {
      await pool.query("UPDATE requirement SET status = 'freigegeben' WHERE external_id = $1", [
        externalId,
      ]);
    }

    it("nennt den unbekannten Ausgangszustand beim Namen", async () => {
      await anlegen("C-1");
      await fremderZustand("C-1");

      const antwort = await mit(alsMensch)("put", zustand("C-1"))
        .send({ toState: "in_pruefung" })
        .expect(409);

      // "Uebergang unzulaessig" schickte die Suche in die falsche Richtung.
      expect(antwort.body.message).toContain("freigegeben");
      expect(antwort.body.message).toContain("zuordnen");
    });

    it("ordnet einen Zustand zu und verzeichnet den Grund", async () => {
      await anlegen("C-2");
      await fremderZustand("C-2");

      const antwort = await mit(alsAdmin)("put", `${zustand("C-2")}/assignment`)
        .send({
          state: "in_pruefung",
          reason: "Altbestand, 'Freigegeben' entspricht 'in_pruefung'",
        })
        .expect(200);

      expect(antwort.body.status).toBe("in_pruefung");

      const { rows } = await pool.query<{ change_kind: string; change_reason: string }>(
        "SELECT change_kind, change_reason FROM requirement_history ORDER BY version DESC LIMIT 1",
      );

      expect(rows[0]).toMatchObject({ change_kind: "state_assignment" });
      expect(rows[0]?.change_reason).toContain("Altbestand");
    });

    it("laesst danach wieder Uebergaenge zu", async () => {
      await anlegen("C-3");
      await fremderZustand("C-3");

      await mit(alsAdmin)("put", `${zustand("C-3")}/assignment`)
        .send({ state: "neu", reason: "Altbestand, zurueck auf den Anfangszustand" })
        .expect(200);

      await mit(alsMensch)("put", zustand("C-3")).send({ toState: "in_pruefung" }).expect(200);
    });

    it("weist die Zuordnung ohne platform-admin ab", async () => {
      await anlegen("C-4");

      await mit(alsMensch)("put", `${zustand("C-4")}/assignment`)
        .send({ state: "in_pruefung", reason: "Ohne Berechtigung versucht" })
        .expect(403);
    });

    it("verlangt eine Begruendung", async () => {
      await anlegen("C-5");

      await mit(alsAdmin)("put", `${zustand("C-5")}/assignment`)
        .send({ state: "in_pruefung", reason: "kurz" })
        .expect(400);
    });
  });

  describe("Fremdgefuehrte Workflows (ADR-0021)", () => {
    it("nimmt jeden Zustand des Graphen entgegen, ohne Uebergang", async () => {
      await registriereWorkflow(pool, null, {
        mode: "external",
        initialState: "offen",
        states: [
          { key: "offen", label: "Offen" },
          { key: "geschlossen", label: "Geschlossen" },
        ],
        transitions: [],
      });

      const angelegt = await anlegen("D-1");
      expect(angelegt.status).toBe("offen");

      // Jira hat entschieden. Ein Zielzustand von dort ist eine Mitteilung, keine Bitte -
      // es gibt keinen Uebergang, und es braucht keinen.
      const antwort = await mit(alsMensch)("put", zustand("D-1"))
        .send({ toState: "geschlossen" })
        .expect(200);

      expect(antwort.body.status).toBe("geschlossen");
    });
  });

  describe("Wechsel der Anforderungsart (ADR-0023)", () => {
    it("bindet an den Workflow der neuen Art", async () => {
      await registriereWorkflow(pool);
      await registriereWorkflow(pool, "bug");
      await anlegen("E-1");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/E-1")
        .send({ requirementType: "bug" })
        .expect(200);

      const { rows } = await pool.query<{ label: string }>(
        `SELECT w.label FROM requirement r
           JOIN workflow_definition w ON w.id = r.workflow_definition_id
          WHERE r.external_id = $1`,
        ["E-1"],
      );

      expect(rows[0]?.label).toBe("Ablauf bug");
    });

    it("weist den Wechsel ab, wenn die neue Art keinen Workflow hat", async () => {
      // Nur ein typbezogener Workflow, kein allgemeiner - fuer "bug" gibt es damit keinen.
      await registriereWorkflow(pool, "feature");
      await anlegen("E-2");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/E-2")
        .send({ requirementType: "bug" })
        .expect(400);
    });

    it("laesst die Bindung unberuehrt, wenn die Art gleich bleibt", async () => {
      const workflow = await registriereWorkflow(pool);
      await anlegen("E-3");

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/E-3")
        .send({ owner: "T. Schmidt" })
        .expect(200);

      const { rows } = await pool.query<{ workflow_definition_id: string }>(
        "SELECT workflow_definition_id FROM requirement WHERE external_id = $1",
        ["E-3"],
      );

      expect(rows[0]?.workflow_definition_id).toBe(workflow.id);
    });
  });
});
