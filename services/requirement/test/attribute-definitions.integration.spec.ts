import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestDatabase, type TestDatabase } from "./support/test-database";

describe("Attributdefinitionen", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let adminToken: string;
  let autorToken: string;

  const gueltig = {
    key: "kostenstelle",
    label: "Kostenstelle",
    dataType: "text",
    required: true,
  };

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
      realm_access: { roles: ["platform-admin"] },
    });
    autorToken = jwks.sign({
      sub: "benutzer-1",
      azp: "frontend",
      preferred_username: "test.author",
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
    await pool.query("TRUNCATE TABLE attribute_definition, attribute_definition_history");
  });

  const alsAdmin = () =>
    request(app.getHttpServer())
      .post("/v1/attribute-definitions")
      .set("Authorization", `Bearer ${adminToken}`);

  describe("Berechtigung", () => {
    it("weist das Anlegen ohne platform-admin ab", async () => {
      await request(app.getHttpServer())
        .post("/v1/attribute-definitions")
        .set("Authorization", `Bearer ${autorToken}`)
        .send(gueltig)
        .expect(403);
    });

    it("laesst das Lesen ohne platform-admin zu", async () => {
      await request(app.getHttpServer())
        .get("/v1/attribute-definitions")
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(200);
    });

    it("weist ohne Token ab", async () => {
      await request(app.getHttpServer()).get("/v1/attribute-definitions").expect(401);
    });
  });

  describe("Anlegen", () => {
    it("legt eine Definition an und liefert sie zurueck", async () => {
      const antwort = await alsAdmin().send(gueltig).expect(201);

      expect(antwort.body).toMatchObject({
        key: "kostenstelle",
        requirementType: null,
        dataType: "text",
        required: true,
        allowedValues: null,
        active: true,
        version: 1,
      });
    });

    it("weist einen Schluessel mit unzulaessigen Zeichen ab", async () => {
      await alsAdmin()
        .send({ ...gueltig, key: "Kosten-Stelle" })
        .expect(400);
    });

    it("weist denselben Schluessel fuer denselben Typ mit 409 ab", async () => {
      await alsAdmin().send(gueltig).expect(201);
      await alsAdmin().send(gueltig).expect(409);
    });

    it("erlaubt denselben Schluessel fuer verschiedene Typen", async () => {
      await alsAdmin().send(gueltig).expect(201);
      await alsAdmin()
        .send({ ...gueltig, requirementType: "bestellung" })
        .expect(201);
    });

    it("verlangt allowedValues bei enum", async () => {
      await alsAdmin()
        .send({ ...gueltig, dataType: "enum" })
        .expect(400);
    });

    it("lehnt allowedValues bei text ab", async () => {
      await alsAdmin()
        .send({ ...gueltig, allowedValues: ["a", "b"] })
        .expect(400);
    });
  });

  describe("Aendern", () => {
    it("erhoeht die Version und schreibt eine zweite Historienzeile", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      const geaendert = await request(app.getHttpServer())
        .put(`/v1/attribute-definitions/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ label: "Kostenstelle (neu)", dataType: "text", required: false, active: true })
        .expect(200);

      expect(geaendert.body).toMatchObject({ label: "Kostenstelle (neu)", version: 2 });

      const versionen = await request(app.getHttpServer())
        .get(`/v1/attribute-definitions/${id}/versions`)
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(200);

      expect(versionen.body).toHaveLength(2);
      expect(versionen.body[0]).toMatchObject({ version: 1, operation: "insert" });
      expect(versionen.body[1]).toMatchObject({ version: 2, operation: "update", validTo: null });
    });

    it("schliesst den Gueltigkeitszeitraum der Vorgaengerversion lueckenlos", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      await request(app.getHttpServer())
        .put(`/v1/attribute-definitions/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ label: "Zweite Fassung", dataType: "text", required: true, active: true })
        .expect(200);

      const { rows } = await pool.query<{ valid_to: Date | null; valid_from: Date }>(
        "SELECT valid_from, valid_to FROM attribute_definition_history WHERE id = $1 ORDER BY version",
        [id],
      );

      // Kein Loch und keine Ueberlappung: Ende der ersten ist Beginn der zweiten.
      expect(rows[0]?.valid_to).toEqual(rows[1]?.valid_from);
      expect(rows[1]?.valid_to).toBeNull();
    });

    it("setzt ausser Kraft, ohne zu loeschen", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      await request(app.getHttpServer())
        .put(`/v1/attribute-definitions/${id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ label: "Kostenstelle", dataType: "text", required: true, active: false })
        .expect(200);

      // Weiterhin auffindbar - bestehende Anforderungen tragen Werte, die ohne die
      // Definition nicht deutbar waeren.
      const alle = await request(app.getHttpServer())
        .get("/v1/attribute-definitions")
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(200);

      expect(alle.body).toHaveLength(1);
      expect(alle.body[0]).toMatchObject({ active: false });
    });

    it("weist eine unbekannte Kennung mit 404 ab", async () => {
      await request(app.getHttpServer())
        .put("/v1/attribute-definitions/11111111-1111-4111-8111-111111111111")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ label: "x", dataType: "text", required: false, active: true })
        .expect(404);
    });
  });

  describe("Geltung je Anforderungstyp", () => {
    it("liefert typbezogene und allgemeine Definitionen zusammen", async () => {
      await alsAdmin().send(gueltig).expect(201);
      await alsAdmin()
        .send({ ...gueltig, key: "lieferdatum", dataType: "date", requirementType: "bestellung" })
        .expect(201);
      await alsAdmin()
        .send({ ...gueltig, key: "aufwand", dataType: "number", requirementType: "feature" })
        .expect(201);

      const antwort = await request(app.getHttpServer())
        .get("/v1/attribute-definitions?requirementType=bestellung")
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(200);

      const schluessel = (antwort.body as { key: string }[]).map((e) => e.key).sort();
      expect(schluessel).toEqual(["kostenstelle", "lieferdatum"]);
    });

    it("blendet ausser Kraft gesetzte Definitionen aus der Typabfrage aus", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);

      await request(app.getHttpServer())
        .put(`/v1/attribute-definitions/${angelegt.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ label: "Kostenstelle", dataType: "text", required: true, active: false })
        .expect(200);

      const antwort = await request(app.getHttpServer())
        .get("/v1/attribute-definitions?requirementType=bestellung")
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(200);

      expect(antwort.body).toHaveLength(0);
    });
  });
});
