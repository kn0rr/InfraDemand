import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

const ISSUER = "http://localhost:8080/realms/infrademand";
const AUDIENCE = "requirement-api";

async function holeToken(): Promise<string> {
  const antwort = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "frontend",
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
 * Der einzige Test gegen echtes Keycloak. Er prueft nicht die Kryptografie - das tun die
 * schnellen Tests besser -, sondern unsere Annahmen ueber die Realm-Konfiguration:
 * Ausstellerbezeichnung, Zielgruppen-Anspruch und Rollenstruktur. Genau diese Annahmen
 * driften, wenn jemand den Realm aendert (ADR-0008).
 */
describe("Authentifizierung gegen echtes Keycloak", () => {
  let app: NestFastifyApplication;
  let token: string;

  beforeAll(async () => {
    process.env["KEYCLOAK_ISSUER_URL"] = ISSUER;
    process.env["KEYCLOAK_AUDIENCE"] = AUDIENCE;

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

    expect(antwort.body).toEqual([]);
  });

  it("weist auch hier Anfragen ohne Token ab", async () => {
    await request(app.getHttpServer()).get("/v1/requirements").expect(401);
  });
});
