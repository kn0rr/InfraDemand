import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { registriereAttribut } from "./support/attribute-definitions";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { registriereWorkflow } from "./support/workflows";

/**
 * Feldebene: Sichtbarkeit je Attribut und Rolle (§6, §8, ADR-0030 Punkt 3).
 *
 * Gepflegt wird in der Attributdefinition, entschieden in der Engine, zugeschnitten im
 * Dienst. Geprueft wird hier das Ergebnis - was der Aufrufer tatsaechlich bekommt.
 *
 * **Beide Token gehoeren derselben Gruppe an.** Sonst saehe der Controller den Datensatz
 * des Anwenders ueberhaupt nicht (ADR-0030 Punkt 2), und jeder Test hier waere gruen, ohne
 * die Feldebene zu beruehren.
 */
describe("Feldebene (ADR-0030)", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let alsAnwender: string;
  let alsController: string;

  const anlage = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    tenant: "t-eins",
    responsibleGroup: "team-a",
    dynamicAttributes: { prio: "hoch", kosten: "12000" },
  };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    alsAnwender = jwks.sign({
      sub: "b-1",
      azp: "frontend",
      tenants: ["t-eins"],
      groups: ["team-a"],
    });
    alsController = jwks.sign({
      sub: "b-2",
      azp: "frontend",
      tenants: ["t-eins"],
      groups: ["team-a"],
      realm_access: { roles: ["controller"] },
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
    await app?.close();
    await pool?.end();
    await database?.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE requirement, requirement_history CASCADE");
    await pool.query("TRUNCATE TABLE attribute_definition, attribute_definition_history CASCADE");
    await pool.query("TRUNCATE TABLE workflow_definition, workflow_definition_history CASCADE");
    await registriereWorkflow(pool);

    await registriereAttribut(pool, { key: "prio" });
    await registriereAttribut(pool, { key: "kosten", visibleFor: ["controller"] });
  });

  const mit = (token: string) => (methode: "post" | "get", pfad: string) =>
    request(app.getHttpServer())[methode](pfad).set("Authorization", `Bearer ${token}`);

  async function anlegen(token: string) {
    const antwort = await mit(token)("post", "/v1/requirements").send(anlage).expect(201);

    return antwort.body as { id: string; dynamicAttributes: Record<string, unknown> };
  }

  it("verbirgt ein beschraenktes Attribut vor dem Anwender", async () => {
    await anlegen(alsAnwender);

    const antwort = await mit(alsAnwender)("get", "/v1/requirements").expect(200);

    // **Das Feld fehlt, es steht nicht auf null.** Sonst waere es von „nicht gesetzt"
    // nicht zu unterscheiden - und `null` bedeutet bei den uebrigen Feldern genau das.
    expect(antwort.body[0].dynamicAttributes).not.toHaveProperty("kosten");
  });

  it("zeigt es dem Traeger der Rolle", async () => {
    await anlegen(alsAnwender);

    const antwort = await mit(alsController)("get", "/v1/requirements").expect(200);

    expect(antwort.body[0].dynamicAttributes.kosten).toBe("12000");
  });

  it("laesst unbeschraenkte Attribute unberuehrt", async () => {
    // Kein Rundumschlag: Die Beschraenkung trifft nur, was sie benennt.
    await anlegen(alsAnwender);

    const antwort = await mit(alsAnwender)("get", "/v1/requirements").expect(200);

    expect(antwort.body[0].dynamicAttributes.prio).toBe("hoch");
  });

  it("verbirgt es auch in der Antwort des Anlegens", async () => {
    // Derselbe Wert, anderer Weg. Wer nur die Liste zuschneidet, gibt ihn hier heraus.
    const angelegt = await anlegen(alsAnwender);

    expect(angelegt.dynamicAttributes).not.toHaveProperty("kosten");
    expect(angelegt.dynamicAttributes["prio"]).toBe("hoch");
  });

  it("verbirgt es auch in der Versionshistorie", async () => {
    // Der Weg, der am leichtesten vergessen wird - dieselben Werte, dritter Endpunkt.
    const angelegt = await anlegen(alsAnwender);

    const antwort = await mit(alsAnwender)(
      "get",
      `/v1/requirements/${angelegt.id}/versions`,
    ).expect(200);

    expect(antwort.body[0].dynamicAttributes).not.toHaveProperty("kosten");
    expect(antwort.body[0].dynamicAttributes.prio).toBe("hoch");
  });

  it("zeigt Werte, deren Definition ausser Kraft gesetzt wurde", async () => {
    // Der Beleg fuer die **Verbotsliste** statt einer Erlaubnisliste: `geltendeDefinitionen`
    // liefert nur aktive Definitionen. Eine Erlaubnisliste liesze diesen Wert verschwinden -
    // und ADR-0012 Punkt 6 haelt deaktivierte Definitionen gerade deshalb, weil bestehende
    // Anforderungen Werte tragen, die nur mit ihnen deutbar sind.
    await anlegen(alsAnwender);
    await pool.query("UPDATE attribute_definition SET active = false WHERE key = 'kosten'");

    const antwort = await mit(alsAnwender)("get", "/v1/requirements").expect(200);

    expect(antwort.body[0].dynamicAttributes.kosten).toBe("12000");
  });
});
