import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { registriereQuelle } from "./support/source-systems";
import { startTestDatabase, type TestDatabase } from "./support/test-database";

describe("Festhaltung von Feldern", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let alsVorsystem: string;
  let alsMensch: string;
  let alsAdmin: string;

  const basis = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    status: "neu",
    owner: "M. Weber",
  };

  const GRUND = "Von SAP falsch gepflegt, Korrektur dort beantragt";

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    alsVorsystem = jwks.sign({ sub: "dienst-1", azp: "sap" });
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
  });

  const mit =
    (token: string) => (methode: "post" | "patch" | "put" | "delete" | "get", pfad: string) =>
      request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${token}`);

  const pfad = (externalId: string) => `/v1/requirements/by-source/sap/${externalId}`;

  async function importiere(externalId: string) {
    return mit(alsVorsystem)("post", "/v1/requirements")
      .send({ ...basis, sourceSystem: "sap", externalId })
      .expect(201);
  }

  async function halteFest(externalId: string, field: string) {
    return mit(alsAdmin)("put", `${pfad(externalId)}/holds/${field}`)
      .send({ reason: GRUND })
      .expect(200);
  }

  describe("Setzen und Aufheben", () => {
    it("haelt ein Feld fest und erzeugt dabei eine neue Version", async () => {
      await importiere("A-1");

      const antwort = await halteFest("A-1", "owner");

      expect(antwort.body.version).toBe(2);
      expect(antwort.body.heldFields.owner).toMatchObject({
        by: "admin-1",
        reason: GRUND,
      });
      // Der Fachwert bleibt unangetastet.
      expect(antwort.body.owner).toBe("M. Weber");
    });

    it("verlangt eine Begruendung", async () => {
      await importiere("A-2");

      await mit(alsAdmin)("put", `${pfad("A-2")}/holds/owner`)
        .send({ reason: "x" })
        .expect(400);
    });

    it("weist ein unbekanntes Feld ab", async () => {
      await importiere("A-3");

      await mit(alsAdmin)("put", `${pfad("A-3")}/holds/gibtsnicht`)
        .send({ reason: GRUND })
        .expect(400);
    });

    it("weist das Festhalten ohne platform-admin ab", async () => {
      await importiere("A-4");

      await mit(alsMensch)("put", `${pfad("A-4")}/holds/owner`)
        .send({ reason: GRUND })
        .expect(403);
    });

    it("hebt eine Festhaltung wieder auf", async () => {
      await importiere("A-5");
      await halteFest("A-5", "owner");

      const antwort = await mit(alsAdmin)("delete", `${pfad("A-5")}/holds/owner`).expect(200);

      expect(antwort.body.heldFields).toEqual({});
      expect(antwort.body.version).toBe(3);
    });

    it("weist das Aufheben einer nicht bestehenden Festhaltung ab", async () => {
      await importiere("A-6");

      await mit(alsAdmin)("delete", `${pfad("A-6")}/holds/owner`).expect(404);
    });
  });

  describe("Wirkung auf den Import", () => {
    it("laesst den Import weiterlaufen und uebernimmt die uebrigen Felder", async () => {
      await importiere("B-1");
      await halteFest("B-1", "owner");

      // ADR-0019 Punkt 2: verzeichnen und fortfahren - ein naechtlicher Lauf hat
      // niemanden, dem er eine Ablehnung sagen koennte.
      const antwort = await mit(alsVorsystem)("patch", pfad("B-1"))
        .send({ owner: "L. Braun", status: "in_arbeit" })
        .expect(200);

      expect(antwort.body.owner).toBe("M. Weber");
      expect(antwort.body.status).toBe("in_arbeit");
    });

    it("verzeichnet die abgewiesene Lieferung", async () => {
      const angelegt = await importiere("B-2");
      await halteFest("B-2", "owner");

      await mit(alsVorsystem)("patch", pfad("B-2")).send({ owner: "L. Braun" }).expect(200);

      const { rows } = await pool.query<{ field: string; rejected_value: unknown; reason: string }>(
        "SELECT field, rejected_value, reason FROM write_rejection WHERE requirement_id = $1",
        [angelegt.body.id],
      );

      expect(rows).toEqual([{ field: "owner", rejected_value: "L. Braun", reason: "field_held" }]);
    });

    it("verzeichnet nichts, wenn der Import denselben Wert liefert", async () => {
      const angelegt = await importiere("B-3");
      await halteFest("B-3", "owner");

      await mit(alsVorsystem)("patch", pfad("B-3")).send({ owner: "M. Weber" }).expect(200);

      const { rows } = await pool.query("SELECT 1 FROM write_rejection WHERE requirement_id = $1", [
        angelegt.body.id,
      ]);

      expect(rows).toHaveLength(0);
    });

    it("haelt den Menschen nicht fern - die Festhaltung schuetzt seinen Wert", async () => {
      await importiere("B-4");
      await halteFest("B-4", "owner");

      const antwort = await mit(alsMensch)("patch", pfad("B-4"))
        .send({ owner: "T. Schmidt" })
        .expect(200);

      expect(antwort.body.owner).toBe("T. Schmidt");
    });

    it("laesst den Import nach dem Aufheben wieder durch", async () => {
      await importiere("B-5");
      await halteFest("B-5", "owner");
      await mit(alsAdmin)("delete", `${pfad("B-5")}/holds/owner`).expect(200);

      const antwort = await mit(alsVorsystem)("patch", pfad("B-5"))
        .send({ owner: "L. Braun" })
        .expect(200);

      expect(antwort.body.owner).toBe("L. Braun");
    });
  });

  describe("Nachweisfuehrung", () => {
    it("zeigt in der Historie, wann festgehalten wurde", async () => {
      const angelegt = await importiere("C-1");
      await halteFest("C-1", "owner");

      const versionen = await mit(alsMensch)(
        "get",
        `/v1/requirements/${angelegt.body.id}/versions`,
      ).expect(200);

      // Bestandteil des versionierten Zustands (ADR-0017 B9): Eine Stichtagsabfrage
      // zeigt damit, was zu diesem Zeitpunkt festgehalten war.
      expect(versionen.body[0].heldFields).toEqual({});
      expect(versionen.body[1].heldFields.owner).toMatchObject({ reason: GRUND });
    });
  });
  describe("Uebersicht (ADR-0017 B14)", () => {
    it("weist die Uebersicht ohne platform-admin ab", async () => {
      await mit(alsMensch)("get", "/v1/requirements/holds").expect(403);
    });

    it("liefert nichts, solange nichts festgehalten ist", async () => {
      await importiere("D-0");

      const antwort = await mit(alsAdmin)("get", "/v1/requirements/holds").expect(200);

      expect(antwort.body).toEqual([]);
    });

    it("nennt Feld, Wert, Begruendung und Herkunft", async () => {
      const angelegt = await importiere("D-1");
      await halteFest("D-1", "owner");

      const antwort = await mit(alsAdmin)("get", "/v1/requirements/holds").expect(200);

      expect(antwort.body).toHaveLength(1);
      expect(antwort.body[0]).toMatchObject({
        requirementId: angelegt.body.id,
        sourceSystem: "sap",
        externalId: "D-1",
        field: "owner",
        heldValue: "M. Weber",
        heldBy: "admin-1",
        reason: GRUND,
        // Noch hat kein Lauf versucht, das Feld zu aendern.
        lastRejection: null,
      });
    });

    it("beziffert die Abweichung, sobald ein Lauf abgewiesen wurde", async () => {
      await importiere("D-2");
      await halteFest("D-2", "owner");

      // Zwei Laeufe mit demselben abweichenden Wert.
      await mit(alsVorsystem)("patch", pfad("D-2")).send({ owner: "L. Braun" }).expect(200);
      await mit(alsVorsystem)("patch", pfad("D-2")).send({ owner: "L. Braun" }).expect(200);

      const antwort = await mit(alsAdmin)("get", "/v1/requirements/holds").expect(200);

      // Das ist der eigentliche Ertrag: "wir halten M. Weber, das Vorsystem liefert seit
      // zwei Laeufen L. Braun". Ohne diese Angabe zeigt die Durchsicht nur einen Zustand.
      expect(antwort.body[0]).toMatchObject({
        heldValue: "M. Weber",
        lastRejection: { value: "L. Braun", sourceSystem: "sap", count: 2 },
      });
    });

    it("fuehrt mehrere festgehaltene Felder eines Datensatzes einzeln auf", async () => {
      await importiere("D-3");
      await halteFest("D-3", "owner");
      await halteFest("D-3", "status");

      const antwort = await mit(alsAdmin)("get", "/v1/requirements/holds").expect(200);

      expect((antwort.body as { field: string }[]).map((e) => e.field).sort()).toEqual([
        "owner",
        "status",
      ]);
    });
  });
});
