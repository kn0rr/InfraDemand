import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { registriereAttribut } from "./support/attribute-definitions";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow } from "./support/workflows";

describe("Mandantenzuschnitt (ADR-0026)", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let alsEins: string;
  let alsZwei: string;
  let alsEinsZweiter: string;
  let alsBetreiber: string;
  let alsBeide: string;
  let ohneZugehoerigkeit: string;
  let alsQuelleEins: string;
  let alsQuelleZwei: string;
  let alsGruppenmitglied: string;

  const anlage = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
  };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    alsEins = jwks.sign({ sub: "b-1", azp: "frontend", tenants: ["t-eins"], groups: ["team-a"] });
    alsZwei = jwks.sign({ sub: "b-2", azp: "frontend", tenants: ["t-zwei"], groups: ["team-b"] });
    alsBeide = jwks.sign({ sub: "b-3", azp: "frontend", tenants: ["t-eins", "t-zwei"] });
    alsQuelleEins = jwks.sign({ sub: "d-1", azp: "sap", tenants: ["t-eins"] });
    alsQuelleZwei = jwks.sign({ sub: "d-2", azp: "sap", tenants: ["t-zwei"] });
    alsGruppenmitglied = jwks.sign({
      sub: "b-7",
      azp: "frontend",
      tenants: ["t-eins"],
      groups: ["team-a"],
    });
    alsEinsZweiter = jwks.sign({ sub: "b-5", azp: "frontend", tenants: ["t-eins"] });
    alsBetreiber = jwks.sign({
      sub: "b-6",
      azp: "frontend",
      tenants: ["t-eins"],
      realm_access: { roles: ["platform-admin"] },
    });
    // Kein `tenants`-Anspruch: der Fall, den ein Realm ohne Mapper erzeugt.
    ohneZugehoerigkeit = jwks.sign({ sub: "b-4", azp: "frontend" });

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
    await pool.query("TRUNCATE TABLE mastership_rule, mastership_rule_history CASCADE");
    await pool.query("TRUNCATE TABLE attribute_definition, attribute_definition_history CASCADE");
    await pool.query("TRUNCATE TABLE workflow_definition, workflow_definition_history CASCADE");
    await registriereWorkflow(pool);
  });

  const mit = (token: string) => (methode: "post" | "patch" | "put" | "get", pfad: string) =>
    request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${token}`);

  async function anlegen(token: string, tenant: string, externalId?: string, gruppe?: string) {
    const antwort = await mit(token)("post", "/v1/requirements")
      .send({
        ...anlage,
        tenant,
        ...(externalId === undefined ? {} : { sourceSystem: "sap", externalId }),
        ...(gruppe === undefined ? {} : { responsibleGroup: gruppe }),
      })
      .expect(201);

    return antwort.body as { id: string; tenant: string };
  }

  async function hoheitsregel(field: string, mode: string, tenant: string | null) {
    // Fach- und Historienzeile in einem Zug, aus derselben Ueberlegung wie bei
    // registriereWorkflow: abgeschrieben statt aufgezaehlt.
    await pool.query(
      `WITH neu AS (
         INSERT INTO mastership_rule (tenant, field, mode) VALUES ($1, $2, $3) RETURNING *
       )
       INSERT INTO mastership_rule_history
         (id, tenant, field, mode, bindings, created_at, updated_at, version,
          valid_from, valid_to, operation, changed_by, change_source)
       SELECT id, tenant, field, mode, bindings, created_at, updated_at, version,
              updated_at, NULL, 'insert', 'test-fixture', 'test-fixture'
         FROM neu`,
      [tenant, field, mode],
    );
  }

  describe("Anlegen", () => {
    it("legt im eigenen Mandanten an", async () => {
      const angelegt = await anlegen(alsEins, "t-eins");

      expect(angelegt.tenant).toBe("t-eins");
    });

    it("weist einen fremden Mandanten mit 403 ab", async () => {
      // Die Auswahl kommt vom Aufrufer, aber sie kann nur einschraenken.
      const antwort = await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-zwei" })
        .expect(403);

      expect(antwort.body.message).toContain("t-zwei");
    });

    it("weist ohne jede Zugehoerigkeit ab", async () => {
      await mit(ohneZugehoerigkeit)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-eins" })
        .expect(403);
    });
  });

  describe("Liste", () => {
    it("zeigt nur die eigenen Mandanten", async () => {
      await anlegen(alsEins, "t-eins");
      await anlegen(alsZwei, "t-zwei");

      const eins = await mit(alsEins)("get", "/v1/requirements").expect(200);
      const zwei = await mit(alsZwei)("get", "/v1/requirements").expect(200);

      expect(eins.body.map((e: { tenant: string }) => e.tenant)).toEqual(["t-eins"]);
      expect(zwei.body.map((e: { tenant: string }) => e.tenant)).toEqual(["t-zwei"]);
    });

    it("zeigt bei Mehrfachzugehoerigkeit beide", async () => {
      // ADR-0017 C3 haelt diesen Fall ausdruecklich fest - hier ist er nachgewiesen.
      // Angelegt vom selben Anwender, damit der Test die Zugehoerigkeit prueft und nicht
      // die Eigentuemerschaft (ADR-0029).
      await anlegen(alsBeide, "t-eins");
      await anlegen(alsBeide, "t-zwei");

      const antwort = await mit(alsBeide)("get", "/v1/requirements").expect(200);

      expect(antwort.body.map((e: { tenant: string }) => e.tenant).sort()).toEqual([
        "t-eins",
        "t-zwei",
      ]);
    });

    it("liefert ohne Zugehoerigkeit eine leere Liste, nicht den Bestand", async () => {
      await anlegen(alsEins, "t-eins");

      // „Kein Filter" waere hier die gefaehrlichste aller Auslegungen.
      const antwort = await mit(ohneZugehoerigkeit)("get", "/v1/requirements").expect(200);

      expect(antwort.body).toEqual([]);
    });

    it("filtert auch die Stichtagsabfrage", async () => {
      await anlegen(alsZwei, "t-zwei");

      const antwort = await mit(alsEins)(
        "get",
        `/v1/requirements?asOf=${new Date().toISOString()}`,
      ).expect(200);

      expect(antwort.body).toEqual([]);
    });

    it("zeigt eine fremde Anforderung desselben Mandanten nicht", async () => {
      // Die Korrektur aus ADR-0029: Die Mandantengrenze allein genuegt nicht mehr.
      await anlegen(alsEins, "t-eins");

      const antwort = await mit(alsEinsZweiter)("get", "/v1/requirements").expect(200);

      expect(antwort.body).toEqual([]);
    });

    it("zeigt dem Betreiber den ganzen Mandanten", async () => {
      await anlegen(alsEins, "t-eins");

      const antwort = await mit(alsBetreiber)("get", "/v1/requirements").expect(200);

      expect(antwort.body).toHaveLength(1);
    });

    it("zeigt die Anforderung den Mitgliedern der zustaendigen Gruppe", async () => {
      await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-eins", responsibleGroup: "team-a" })
        .expect(201);

      const mitglied = await mit(alsGruppenmitglied)("get", "/v1/requirements").expect(200);
      // Derselbe Mandant, aber weder Eigentuemer noch in der Gruppe.
      const fremd = await mit(alsEinsZweiter)("get", "/v1/requirements").expect(200);

      expect(mitglied.body).toHaveLength(1);
      expect(fremd.body).toEqual([]);
    });

    it("behaelt die Gruppe ueber einen Zustandswechsel", async () => {
      // Der Fall, den das Pflichtfeld in `RequirementUpdateInput` verhindern soll: `update`
      // schreibt eine vollstaendige Feldliste. Eine dort vergessene Spalte faellt hier auf
      // und nicht erst, wenn jemand nach einem Statuswechsel seine Anforderung nicht mehr
      // findet - und dann ohne Fehlermeldung.
      const angelegt = await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-eins", responsibleGroup: "team-a" })
        .expect(201);

      await mit(alsEins)("put", `/v1/requirements/${angelegt.body.id}/state`)
        .send({ toState: "in_pruefung" })
        .expect(200);

      const danach = await mit(alsGruppenmitglied)("get", "/v1/requirements").expect(200);

      expect(danach.body).toHaveLength(1);
      expect(danach.body[0].responsibleGroup).toBe("team-a");
    });
    it("laesst die Gruppe nachtraeglich setzen", async () => {
      // Eine Vertretung entsteht, wenn jemand ausfaellt - also spaeter, nicht bei der
      // Anlage. Ohne diesen Test war die Spalte nur beim Anlegen beschreibbar, und ein
      // PATCH darauf verschwand wortlos.
      await anlegen(alsEins, "t-eins", "G-1");

      await mit(alsEins)("patch", "/v1/requirements/by-source/sap/G-1")
        .send({ responsibleGroup: "team-a" })
        .expect(200);

      expect(
        (await mit(alsGruppenmitglied)("get", "/v1/requirements").expect(200)).body,
      ).toHaveLength(1);
    });
  });

  describe("Ein fremder Datensatz sieht aus wie keiner", () => {
    /**
     * **404 und nicht 403.** Dass ein Datensatz existiert, ist bereits eine Auskunft ueber
     * den anderen Mandanten. Beide Faelle muessen deshalb gleich aussehen - sonst laesst
     * sich der Bestand eines fremden Mandanten durch Ausprobieren abzaehlen.
     */
    it("bei der Versionshistorie", async () => {
      const fremd = await anlegen(alsZwei, "t-zwei");

      await mit(alsEins)("get", `/v1/requirements/${fremd.id}/versions`).expect(404);
    });

    it("bei den Uebergaengen", async () => {
      const fremd = await anlegen(alsZwei, "t-zwei");

      await mit(alsEins)("get", `/v1/requirements/${fremd.id}/transitions`).expect(404);
    });

    it("beim Zustandswechsel", async () => {
      const fremd = await anlegen(alsZwei, "t-zwei");

      await mit(alsEins)("put", `/v1/requirements/${fremd.id}/state`)
        .send({ toState: "in_pruefung" })
        .expect(404);
    });

    it("beim Aendern ueber die Herkunft", async () => {
      await anlegen(alsZwei, "t-zwei", "A-1");

      await mit(alsEins)("patch", "/v1/requirements/by-source/sap/A-1")
        .send({ owner: "T. Schmidt" })
        .expect(404);
    });

    it("und dem eigenen Mandanten steht derselbe Weg offen", async () => {
      // Der Gegenbeweis: Ohne ihn koennte die Pruefung schlicht alles abweisen.
      const eigen = await anlegen(alsEins, "t-eins", "A-2");

      await mit(alsEins)("patch", "/v1/requirements/by-source/sap/A-2")
        .send({ requirementType: "bug" })
        .expect(200);
      await mit(alsEins)("get", `/v1/requirements/${eigen.id}/versions`).expect(200);
    });

    it("auch bei einem fremden Eigentuemer im eigenen Mandanten", async () => {
      // Die Schliessung von PROD-060: Bisher verbarg die Liste diesen Datensatz, der
      // direkte Zugriff gab ihn heraus.
      const fremd = await anlegen(alsEins, "t-eins");

      await mit(alsEinsZweiter)("get", `/v1/requirements/${fremd.id}/versions`).expect(404);
      await mit(alsEinsZweiter)("put", `/v1/requirements/${fremd.id}/state`)
        .send({ toState: "in_pruefung" })
        .expect(404);
    });
  });

  describe("Gestufte Konfiguration (ADR-0026 Punkt 4 und 5)", () => {
    it("die mandantenspezifische Definition schlaegt die plattformweite", async () => {
      // Bewusst so herum, dass die spezifischere die nachgiebigere ist: Wuerden beide
      // Definitionen angewendet - das Verhalten vor ADR-0026 Punkt 5 -, bliebe prio
      // Pflicht, und der Test waere gruen, ohne die Rangfolge je zu beruehren.
      await registriereAttribut(pool, { key: "prio", required: true });
      await registriereAttribut(pool, { key: "prio", required: false, tenant: "t-eins" });

      await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-eins" })
        .expect(201);

      // Gegenprobe: In t-zwei gilt die plattformweite Pflicht unveraendert.
      await mit(alsZwei)("post", "/v1/requirements")
        .send({ ...anlage, tenant: "t-zwei" })
        .expect(400);
    });

    it("die Anforderungsart wiegt schwerer als der Mandant", async () => {
      // Rang 2 (alle Mandanten, diese Art) gegen Rang 3 (dieser Mandant, alle Arten).
      // Die eine Erwartung unten scheidet drei Verhalten voneinander: Gewaenne der
      // Mandant, waere es 400; wuerden beide angewendet, ebenfalls 400.
      await registriereAttribut(pool, {
        key: "lieferdatum",
        dataType: "date",
        required: false,
        requirementType: "bestellung",
      });
      await registriereAttribut(pool, {
        key: "lieferdatum",
        dataType: "date",
        required: true,
        tenant: "t-eins",
      });

      await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, requirementType: "bestellung", tenant: "t-eins" })
        .expect(201);

      // Und die Regel des Mandanten ist keineswegs wirkungslos - fuer jede andere Art
      // greift sie. Ohne diese Gegenprobe bewiese die 201 oben auch, dass sie nie geladen
      // wurde.
      await mit(alsEins)("post", "/v1/requirements")
        .send({ ...anlage, requirementType: "feature", tenant: "t-eins" })
        .expect(400);
    });

    it("ein mandantenspezifischer Workflow schlaegt den plattformweiten", async () => {
      // Der plattformweite Ablauf kommt aus dem beforeEach und beginnt in "neu".
      await registriereWorkflow(pool, null, {
        tenant: "t-eins",
        initialState: "eigen",
        states: [{ key: "eigen", label: "Eigen" }],
        transitions: [],
      });

      const eins = await anlegen(alsEins, "t-eins");
      const zwei = await anlegen(alsZwei, "t-zwei");

      const zustandEins = await mit(alsEins)("get", `/v1/requirements/${eins.id}/transitions`);
      const zustandZwei = await mit(alsZwei)("get", `/v1/requirements/${zwei.id}/transitions`);

      expect(zustandEins.body.currentState).toBe("eigen");
      expect(zustandZwei.body.currentState).toBe("neu");
    });
    it("die mandantenspezifische Hoheitsregel schlaegt die plattformweite", async () => {
      // Wieder ist die spezifischere die nachgiebigere - sonst kaeme dieselbe Antwort
      // heraus, egal welche der beiden Regeln gewinnt.
      await hoheitsregel("owner", "automatic_wins", null);
      await hoheitsregel("owner", "manual_allowed", "t-eins");

      await anlegen(alsQuelleEins, "t-eins", "M-1", "team-a");
      await anlegen(alsQuelleZwei, "t-zwei", "M-2", "team-b");

      // In t-eins darf die Hand ueberschreiben, was die Quelle gesetzt hat.
      await mit(alsEins)("patch", "/v1/requirements/by-source/sap/M-1")
        .send({ owner: "T. Schmidt" })
        .expect(200);

      // In t-zwei gilt die plattformweite Regel unveraendert.
      await mit(alsZwei)("patch", "/v1/requirements/by-source/sap/M-2")
        .send({ owner: "T. Schmidt" })
        .expect(409);
    });
  });
});
