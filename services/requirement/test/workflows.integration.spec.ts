import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { registriereAttribut } from "./support/attribute-definitions";
import { type JwksTestServer, startJwksTestServer } from "./support/jwks-test-server";
import { startTestDatabase, type TestDatabase } from "./support/test-database";
import { pruefeVersionshistorie } from "./support/versionierung";

describe("Workflow-Definitionen", () => {
  let app: NestFastifyApplication;
  let jwks: JwksTestServer;
  let database: TestDatabase;
  let pool: Pool;
  let adminToken: string;
  let autorToken: string;

  const gueltig = {
    label: "Standardablauf",
    initialState: "neu",
    states: [
      { key: "neu", label: "Neu" },
      { key: "in_pruefung", label: "In Pruefung" },
      { key: "erledigt", label: "Erledigt", final: true },
    ],
    transitions: [
      { from: "neu", to: "in_pruefung", label: "Einreichen" },
      { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
    ],
  };

  /** Der Aenderungsrumpf ist vollstaendig - PUT ersetzt, es gibt keine Teiluebernahme. */
  const gueltigeAenderung = { ...gueltig, mode: "internal", active: true };

  beforeAll(async () => {
    jwks = await startJwksTestServer();
    database = await startTestDatabase();

    process.env["KEYCLOAK_ISSUER_URL"] = jwks.issuer;
    process.env["KEYCLOAK_AUDIENCE"] = "requirement-api";
    process.env["DATABASE_URL"] = database.connectionString;

    adminToken = jwks.sign({
      sub: "admin-1",
      azp: "frontend",
      tenants: ["t-eins"],
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
    await pool.query("TRUNCATE TABLE workflow_definition, workflow_definition_history CASCADE");
  });

  const alsAdmin = () =>
    request(app.getHttpServer())
      .post("/v1/workflow-definitions")
      .set("Authorization", `Bearer ${adminToken}`);

  const aendern = (id: string) =>
    request(app.getHttpServer())
      .put(`/v1/workflow-definitions/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

  describe("Berechtigung", () => {
    it("weist das Anlegen ohne platform-admin ab", async () => {
      await request(app.getHttpServer())
        .post("/v1/workflow-definitions")
        .set("Authorization", `Bearer ${autorToken}`)
        .send(gueltig)
        .expect(403);
    });

    it("weist auch das Lesen ohne platform-admin ab", async () => {
      // Bis M4.5 war das Lesen offen - die Oberflaeche brauchte den Graphen fuer die
      // Zustandsnamen. Seit es `…/transitions` gibt, liest die Liste nur noch der Editor,
      // und sie enthaelt seit M4.3 die Genehmigungsstruktur.
      await request(app.getHttpServer())
        .get("/v1/workflow-definitions")
        .set("Authorization", `Bearer ${autorToken}`)
        .expect(403);
    });

    it("weist ohne Token ab", async () => {
      await request(app.getHttpServer()).get("/v1/workflow-definitions").expect(401);
    });
  });

  describe("Anlegen", () => {
    it("legt einen Workflow an und liefert ihn zurueck", async () => {
      const antwort = await alsAdmin().send(gueltig).expect(201);

      expect(antwort.body).toMatchObject({
        label: "Standardablauf",
        requirementType: null,
        mode: "internal",
        initialState: "neu",
        unreachableStates: [],
        active: true,
        version: 1,
      });
      expect(antwort.body.states).toHaveLength(3);
    });

    it("ergaenzt final, wo es weggelassen wurde", async () => {
      const antwort = await alsAdmin().send(gueltig).expect(201);

      // Der Aufrufer soll nicht zwischen "fehlt" und "false" unterscheiden muessen.
      expect(antwort.body.states[0]).toEqual({ key: "neu", label: "Neu", final: false });
    });

    it("weist einen Anfangszustand ab, den es nicht gibt", async () => {
      const antwort = await alsAdmin()
        .send({ ...gueltig, initialState: "erfunden" })
        .expect(400);

      expect(antwort.body.message).toContain("initialState");
    });

    it("weist einen Uebergang auf einen unbekannten Zustand ab", async () => {
      await alsAdmin()
        .send({
          ...gueltig,
          transitions: [{ from: "neu", to: "erfunden", label: "Nirgendwohin" }],
        })
        .expect(400);
    });

    it("weist eine Sackgasse ohne Endzustandskennzeichnung ab", async () => {
      await alsAdmin()
        .send({
          ...gueltig,
          states: [
            { key: "neu", label: "Neu" },
            { key: "in_pruefung", label: "In Pruefung" },
            { key: "erledigt", label: "Erledigt" },
          ],
        })
        .expect(400);
    });

    it("weist einen Endzustand mit ausgehendem Uebergang ab", async () => {
      await alsAdmin()
        .send({
          ...gueltig,
          transitions: [
            ...gueltig.transitions,
            { from: "erledigt", to: "neu", label: "Wieder oeffnen" },
          ],
        })
        .expect(400);
    });

    it("weist einen Zustandsschluessel mit unzulaessigen Zeichen ab", async () => {
      await alsAdmin()
        .send({
          ...gueltig,
          initialState: "In Pruefung",
          states: [{ key: "In Pruefung", label: "In Pruefung", final: true }],
          transitions: [],
        })
        .expect(400);
    });

    it("weist den zweiten allgemeinen Workflow mit 409 ab", async () => {
      await alsAdmin().send(gueltig).expect(201);
      await alsAdmin()
        .send({ ...gueltig, label: "Noch ein Ablauf" })
        .expect(409);
    });

    it("erlaubt je Anforderungstyp einen eigenen", async () => {
      await alsAdmin().send(gueltig).expect(201);
      await alsAdmin()
        .send({ ...gueltig, requirementType: "bestellung" })
        .expect(201);
      await alsAdmin()
        .send({ ...gueltig, requirementType: "bestellung", label: "Doppelt" })
        .expect(409);
    });

    it("meldet unerreichbare Zustaende, ohne abzuweisen", async () => {
      const antwort = await alsAdmin()
        .send({
          ...gueltig,
          states: [...gueltig.states, { key: "verworfen", label: "Verworfen", final: true }],
        })
        .expect(201);

      // Ein Graph im Aufbau ist unvollstaendig, nicht falsch - deshalb ein Hinweis in
      // der Antwort und keine Abweisung.
      expect(antwort.body.unreachableStates).toEqual(["verworfen"]);
    });
    it("liefert die Bedingungen eines Uebergangs mit", async () => {
      const angelegt = await alsAdmin()
        .send({
          ...gueltig,
          transitions: [
            { from: "neu", to: "in_pruefung", label: "Einreichen" },
            {
              from: "in_pruefung",
              to: "erledigt",
              label: "Freigeben",
              bedingungen: [{ art: "rolle", eineVon: ["freigeber"] }],
            },
          ],
        })
        .expect(201);

      // Ohne sie loeschte der Editor beim Speichern die Bedingungen, weil PUT die
      // Definition vollstaendig ersetzt.
      expect(angelegt.body.transitions[1].bedingungen).toHaveLength(1);
      expect(angelegt.body.transitions[0].bedingungen).toEqual([]);
    });
  });

  describe("Fremdgefuehrte Workflows (ADR-0021)", () => {
    const fremd = {
      label: "Jira-Ablauf",
      requirementType: "incident",
      mode: "external",
      initialState: "offen",
      states: [
        { key: "offen", label: "Offen" },
        { key: "in_arbeit", label: "In Arbeit" },
        { key: "geschlossen", label: "Geschlossen" },
      ],
      transitions: [],
    };

    it("nimmt einen Graphen ohne Uebergaenge an", async () => {
      // Jira entscheidet die Uebergaenge; unser Graph fuehrt nur die Zustaende auf und
      // weist nichts ab (ADR-0021 Punkt 5).
      const antwort = await alsAdmin().send(fremd).expect(201);

      expect(antwort.body).toMatchObject({ mode: "external", transitions: [] });
    });

    it("meldet dort keine unerreichbaren Zustaende", async () => {
      const antwort = await alsAdmin().send(fremd).expect(201);

      // Ohne Uebergaenge waere jeder Zustand ausser dem ersten unerreichbar. Ein Hinweis,
      // der immer erscheint, wird uebersehen.
      expect(antwort.body.unreachableStates).toEqual([]);
    });

    it("weist denselben Graphen eigengefuehrt ab", async () => {
      await alsAdmin()
        .send({ ...fremd, mode: "internal" })
        .expect(400);
    });

    it("weist strukturelle Widersprueche auch fremdgefuehrt ab", async () => {
      await alsAdmin()
        .send({ ...fremd, initialState: "erfunden" })
        .expect(400);
    });
  });

  describe("Aendern", () => {
    it("erhoeht die Version und schreibt eine zweite Historienzeile", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      const geaendert = await aendern(id)
        .send({ ...gueltigeAenderung, label: "Standardablauf (neu)" })
        .expect(200);

      expect(geaendert.body).toMatchObject({ label: "Standardablauf (neu)", version: 2 });

      const versionen = await request(app.getHttpServer())
        .get(`/v1/workflow-definitions/${id}/versions`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(versionen.body).toHaveLength(2);
      expect(versionen.body[0]).toMatchObject({ version: 1, operation: "insert" });
      expect(versionen.body[1]).toMatchObject({ version: 2, operation: "update", validTo: null });
    });

    it("bewahrt den alten Graphen in der Vorgaengerversion", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      await aendern(id)
        .send({
          ...gueltigeAenderung,
          states: [
            { key: "neu", label: "Neu" },
            { key: "erledigt", label: "Erledigt", final: true },
          ],
          transitions: [{ from: "neu", to: "erledigt", label: "Direkt abschliessen" }],
        })
        .expect(200);

      const versionen = await request(app.getHttpServer())
        .get(`/v1/workflow-definitions/${id}/versions`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // Das ist die Zusicherung aus §7: Eine laufende Anforderung bleibt auf ihrer
      // Fassung, und die Fassung traegt den vollstaendigen Graphen - nicht nur die
      // Aenderung gegenueber der naechsten.
      expect(versionen.body[0].states).toHaveLength(3);
      expect(versionen.body[1].states).toHaveLength(2);
    });

    it("laesst den Wechsel der Betriebsart zu", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);

      const geaendert = await aendern(angelegt.body.id as string)
        .send({ ...gueltigeAenderung, mode: "external" })
        .expect(200);

      expect(geaendert.body.mode).toBe("external");
    });

    it("weist einen widerspruechlichen Graphen auch beim Aendern ab", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);

      await aendern(angelegt.body.id as string)
        .send({ ...gueltigeAenderung, initialState: "erfunden" })
        .expect(400);
    });

    it("setzt ausser Kraft, ohne zu loeschen", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);

      await aendern(angelegt.body.id as string)
        .send({ ...gueltigeAenderung, active: false })
        .expect(200);

      const alle = await request(app.getHttpServer())
        .get("/v1/workflow-definitions")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(alle.body).toHaveLength(1);
      expect(alle.body[0]).toMatchObject({ active: false });
    });

    it("weist eine unbekannte Kennung mit 404 ab", async () => {
      await aendern("11111111-1111-4111-8111-111111111111").send(gueltigeAenderung).expect(404);
    });

    it("weist eine unbekannte Kennung bei der Historie mit 404 ab", async () => {
      await request(app.getHttpServer())
        .get("/v1/workflow-definitions/11111111-1111-4111-8111-111111111111/versions")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe("Versionshistorie", () => {
    it("haelt die zeitliche Zusicherung aus ADR-0012 ein", async () => {
      const angelegt = await alsAdmin().send(gueltig).expect(201);
      const id = angelegt.body.id as string;

      await aendern(id)
        .send({ ...gueltigeAenderung, label: "Zweite" })
        .expect(200);
      await aendern(id)
        .send({ ...gueltigeAenderung, label: "Dritte" })
        .expect(200);
      await alsAdmin()
        .send({ ...gueltig, requirementType: "bestellung" })
        .expect(201);

      const verstoesse = await pruefeVersionshistorie(
        pool,
        "workflow_definition",
        "workflow_definition_history",
      );

      expect(verstoesse).toEqual([]);
    });
  });

  describe("Bedingungen (ADR-0024)", () => {
    const mitBedingungen = (bedingungen: unknown[]) => ({
      ...gueltig,
      transitions: [
        { from: "neu", to: "in_pruefung", label: "Einreichen" },
        { from: "in_pruefung", to: "erledigt", label: "Freigeben", bedingungen },
      ],
    });

    it("nimmt eine Bedingung auf einem Kernfeld an", async () => {
      await alsAdmin()
        .send(mitBedingungen([{ art: "identitaet", feld: "owner" }]))
        .expect(201);
    });

    it("nimmt eine Bedingung auf einem geltenden Attribut an", async () => {
      await registriereAttribut(pool, { key: "kostenschaetzung", dataType: "number" });

      await alsAdmin()
        .send(
          mitBedingungen([
            {
              art: "rolle",
              eineVon: ["budget-freigeber"],
              nurWenn: [{ feld: "kostenschaetzung", operator: "mindestens", wert: 50000 }],
            },
          ]),
        )
        .expect(201);
    });

    it("weist ein Feld ab, das es nicht gibt", async () => {
      // Eine Pflicht auf ein nicht vorhandenes Feld waere nie erfuellbar - der Uebergang
      // dauerhaft gesperrt, und auffallen wuerde es erst, wenn jemand feststeckt.
      const antwort = await alsAdmin()
        .send(mitBedingungen([{ art: "pflichtfelder", felder: ["gibt_es_nicht"] }]))
        .expect(400);

      expect(antwort.body.message).toContain("gibt_es_nicht");
    });

    it("weist einen unpassenden Wert zum Operator ab", async () => {
      const antwort = await alsAdmin()
        .send(
          mitBedingungen([
            {
              art: "rolle",
              eineVon: ["freigeber"],
              nurWenn: [{ feld: "owner", operator: "istEinesVon", wert: "nicht-liste" }],
            },
          ]),
        )
        .expect(400);

      // Nicht die Rumpfpruefung, sondern die Graphpruefung soll das abweisen.
      expect(antwort.body.message).toContain("istEinesVon erwartet eine Liste");
    });

    it("weist Bedingungen an einem fremdgefuehrten Workflow ab", async () => {
      // Dort entscheidet das Fremdsystem - die Bedingung wuerde nie ausgewertet und saehe
      // trotzdem aus wie eine Zusicherung (ADR-0021 Punkt 4).
      const antwort = await alsAdmin()
        .send({
          ...mitBedingungen([{ art: "identitaet", feld: "owner" }]),
          mode: "external",
        })
        .expect(400);

      expect(antwort.body.message).toContain("wirkungslos");
    });

    it("weist einen Vier-Augen-Bezug ab, der nicht auf jedem Weg liegt", async () => {
      const antwort = await alsAdmin()
        .send({
          label: "Mit Eilverfahren",
          initialState: "neu",
          states: [
            { key: "neu", label: "Neu" },
            { key: "in_pruefung", label: "In Pruefung" },
            { key: "eilverfahren", label: "Eilverfahren" },
            { key: "erledigt", label: "Erledigt", final: true },
          ],
          transitions: [
            { from: "neu", to: "in_pruefung", label: "Einreichen" },
            { from: "neu", to: "eilverfahren", label: "Eilig einreichen" },
            { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
            {
              from: "eilverfahren",
              to: "erledigt",
              label: "Eilig freigeben",
              // Ueber das Eilverfahren wird "in_pruefung" nie betreten.
              bedingungen: [{ art: "vier_augen", andersAlsBeiEintritt: "in_pruefung" }],
            },
          ],
        })
        .expect(400);

      expect(antwort.body.message).toContain("nicht auf jedem Weg");
    });
  });
  describe("Mandant (ADR-0026)", () => {
    it("legt einen mandantenspezifischen Workflow an und gibt ihn zurueck", async () => {
      const antwort = await alsAdmin()
        .send({
          label: "Ablauf t-eins",
          tenant: "t-eins",
          initialState: "neu",
          states: [{ key: "neu", label: "Neu" }],
          transitions: [],
        })
        .expect(201);

      expect(antwort.body.tenant).toBe("t-eins");

      const { rows } = await pool.query<{ tenant: string }>(
        "SELECT tenant FROM workflow_definition WHERE label = 'Ablauf t-eins'",
      );

      expect(rows[0]?.tenant).toBe("t-eins");
    });

    it("weist einen fremden Mandanten mit 403 ab", async () => {
      await alsAdmin()
        .send({
          label: "Fremd",
          tenant: "t-drei",
          initialState: "neu",
          states: [{ key: "neu", label: "Neu" }],
          transitions: [],
        })
        .expect(403);
    });

    it("laesst einen mandantenspezifischen Workflow das Attribut seines Mandanten nennen", async () => {
      // Die Kopplung, die mit dem Mandanten entstand: `pruefeFeldnamen` fragte die
      // Definitionen mit `null` ab, also nur die plattformweiten. Dieser Workflow waere
      // damit an seinem eigenen Attribut gescheitert - mit "unbekanntes Feld".
      await registriereAttribut(pool, { key: "mandantenfeld", tenant: "t-eins" });

      await alsAdmin()
        .send({
          label: "Mit Mandantenfeld",
          tenant: "t-eins",
          initialState: "neu",
          states: [
            { key: "neu", label: "Neu" },
            { key: "geprueft", label: "Geprueft", final: true },
          ],
          transitions: [
            {
              from: "neu",
              to: "geprueft",
              label: "Pruefen",
              bedingungen: [{ art: "pflichtfelder", felder: ["mandantenfeld"] }],
            },
          ],
        })
        .expect(201);
    });

    it("weist einen plattformweiten Workflow ab, der ein Mandantenfeld nennt", async () => {
      // Die Gegenrichtung, und sie ist der Grund fuer die Null-Bedeutung (ADR-0024 Punkt 7):
      // Fuer jeden anderen Mandanten waere die Bedingung nicht auswertbar und der Uebergang
      // dauerhaft gesperrt - ohne dass jemand sieht, warum.
      await registriereAttribut(pool, { key: "mandantenfeld", tenant: "t-eins" });

      await alsAdmin()
        .send({
          label: "Plattformweit mit Mandantenfeld",
          initialState: "neu",
          states: [
            { key: "neu", label: "Neu" },
            { key: "geprueft", label: "Geprueft", final: true },
          ],
          transitions: [
            {
              from: "neu",
              to: "geprueft",
              label: "Pruefen",
              bedingungen: [{ art: "pflichtfelder", felder: ["mandantenfeld"] }],
            },
          ],
        })
        .expect(400);
    });
  });
  describe("Personenfelder (ADR-0031 Punkt 4)", () => {
    const mitIdentitaetAuf = (feld: string) => ({
      label: `Ablauf ${feld}`,
      initialState: "neu",
      states: [
        { key: "neu", label: "Neu" },
        { key: "geprueft", label: "Geprueft", final: true },
      ],
      transitions: [
        {
          from: "neu",
          to: "geprueft",
          label: "Pruefen",
          bedingungen: [{ art: "identitaet", feld }],
        },
      ],
    });

    it("laesst identitaet auf owner zu", async () => {
      await alsAdmin().send(mitIdentitaetAuf("owner")).expect(201);
    });

    it("weist identitaet auf ein Textattribut ab", async () => {
      // Der Fall, der die Pruefung rechtfertigt: Ein Textfeld enthaelt keine Person. Der
      // Vergleich mit dem Ausloesenden traefe nie zu - der Uebergang waere dauerhaft
      // gesperrt, und niemand saehe, warum. Genau so ist `identitaet` zwei Meilensteine
      // lang wirkungslos geblieben.
      await registriereAttribut(pool, { key: "notiz" });

      const antwort = await alsAdmin().send(mitIdentitaetAuf("notiz")).expect(400);

      expect(antwort.body.message).toContain("keine Person");
    });

    it("laesst identitaet auf ein Personenattribut zu", async () => {
      await registriereAttribut(pool, { key: "pruefer", dataType: "person" });

      await alsAdmin().send(mitIdentitaetAuf("pruefer")).expect(201);
    });
  });
});
