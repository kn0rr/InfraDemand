import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

const ISSUER = process.env["KEYCLOAK_ISSUER_URL"] ?? "";

async function holeToken(): Promise<string> {
  const antwort = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "test-cli",
      username: "test.author",
      password: "test",
      grant_type: "password",
    }),
  });

  if (!antwort.ok) {
    throw new Error(
      `Token-Abruf fehlgeschlagen (${antwort.status}). Laeuft die lokale Infrastruktur? ` +
        `Pruefen mit: pnpm run infra:up`,
    );
  }

  const koerper = (await antwort.json()) as { access_token: string };
  return koerper.access_token;
}

/**
 * Laeuft gegen die echte lokale Infrastruktur - Keycloak und die Datenbank "requirement".
 *
 * Bewusst kein Testcontainer fuer die Datenbank: Der Container laeuft mit weitreichenden
 * Rechten, die Rolle "requirement" ist lediglich Eigentuemerin ihrer Datenbank. Nur so
 * ist nachgewiesen, dass die Migrationen mit den tatsaechlichen Rechten durchlaufen.
 *
 * Geprueft werden nicht kryptografische Eigenschaften - das tun die schnellen Tests
 * besser -, sondern unsere Annahmen ueber die Realm-Konfiguration: Ausstellerbezeichnung,
 * Zielgruppen-Anspruch und Rollenstruktur (ADR-0008).
 */
describe("Authentifizierung gegen echtes Keycloak", () => {
  let app: NestFastifyApplication;
  let token: string;

  beforeAll(async () => {
    token = await holeToken();

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
  });

  it("akzeptiert ein von Keycloak ausgestelltes Token", async () => {
    const antwort = await request(app.getHttpServer())
      .get("/v1/requirements")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(antwort.body)).toBe(true);
  });

  it("weist auch hier Anfragen ohne Token ab", async () => {
    await request(app.getHttpServer()).get("/v1/requirements").expect(401);
  });
});
