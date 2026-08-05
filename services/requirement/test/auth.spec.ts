import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";

describe("Authentifizierung", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";

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
    await jwks.close();
  });

  const get = () => request(app.getHttpServer()).get("/v1/requirements");

  it("weist Anfragen ohne Token ab", async () => {
    await get().expect(401);
  });

  it("weist ein unlesbares Token ab", async () => {
    await get().set("Authorization", "Bearer kein-gueltiges-token").expect(401);
  });

  it("weist ein Token mit fremdem Aussteller ab", async () => {
    const token = jwks.sign({ sub: "u1" }, { issuer: "http://fremder-idp" });
    await get().set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("weist ein Token mit falscher Zielgruppe ab", async () => {
    const token = jwks.sign({ sub: "u1" }, { audience: "andere-api" });
    await get().set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("weist ein abgelaufenes Token ab", async () => {
    const token = jwks.sign({ sub: "u1" }, { expiresIn: "-1m" });
    await get().set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("weist ein mit fremdem Schluessel signiertes Token ab", async () => {
    const token = jwks.signWithForeignKey({ sub: "u1" });
    await get().set("Authorization", `Bearer ${token}`).expect(401);
  });

  it("laesst ein gueltiges Token durch", async () => {
    const token = jwks.sign({
      sub: "u1",
      preferred_username: "test.author",
      realm_access: { roles: ["requirement-author"] },
    });

    const response = await get().set("Authorization", `Bearer ${token}`).expect(200);

    expect(response.body).toEqual([]);
  });

  it("laesst /health ohne Token zu", async () => {
    await request(app.getHttpServer()).get("/health").expect(200);
  });
});
