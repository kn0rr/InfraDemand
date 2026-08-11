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

  describe("Bedingungen zur Laufzeit (ADR-0024)", () => {
    /** Legt einen Workflow an, dessen Uebergang `neu -> in_pruefung` Bedingungen traegt. */
    const mitBedingungen = (bedingungen: unknown[]) =>
      registriereWorkflow(pool, null, {
        transitions: [
          { from: "neu", to: "in_pruefung", label: "Einreichen", bedingungen },
          { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
        ],
      });

    it("weist ab, wenn die verlangte Rolle fehlt", async () => {
      await mitBedingungen([{ art: "rolle", eineVon: ["platform-admin"] }]);
      await anlegen("F-1");

      const antwort = await mit(alsMensch)("put", zustand("F-1"))
        .send({ toState: "in_pruefung" })
        .expect(409);

      // Feldbezogen, damit ein Formular alle Gruende auf einmal anzeigen kann.
      expect(antwort.body.conditions).toHaveLength(1);
      expect(antwort.body.conditions[0].kind).toBe("rolle");
    });

    it("laesst durch, wenn sie vorhanden ist", async () => {
      await mitBedingungen([{ art: "rolle", eineVon: ["platform-admin"] }]);
      await anlegen("F-2");

      await mit(alsAdmin)("put", zustand("F-2")).send({ toState: "in_pruefung" }).expect(200);
    });

    it("weist dieselbe Person beim Vier-Augen-Prinzip ab", async () => {
      // `neu` wird beim Anlegen betreten - der Bezug darauf trifft den Ersteller.
      await mitBedingungen([{ art: "vier_augen", andersAlsBeiEintritt: "neu" }]);
      await anlegen("F-3");

      const antwort = await mit(alsMensch)("put", zustand("F-3"))
        .send({ toState: "in_pruefung" })
        .expect(409);

      expect(antwort.body.conditions[0].message).toContain("andere Person");
    });

    it("laesst eine andere Person durch", async () => {
      await mitBedingungen([{ art: "vier_augen", andersAlsBeiEintritt: "neu" }]);
      await anlegen("F-4");

      await mit(alsAdmin)("put", zustand("F-4")).send({ toState: "in_pruefung" }).expect(200);
    });

    it("verlangt gefuellte Pflichtfelder", async () => {
      await registriereAttribut(pool, { key: "abweichungsbegruendung" });
      await mitBedingungen([{ art: "pflichtfelder", felder: ["abweichungsbegruendung"] }]);
      await anlegen("F-5");

      await mit(alsMensch)("put", zustand("F-5")).send({ toState: "in_pruefung" }).expect(409);

      await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/F-5")
        .send({ dynamicAttributes: { abweichungsbegruendung: "Speicherbedarf" } })
        .expect(200);

      await mit(alsMensch)("put", zustand("F-5")).send({ toState: "in_pruefung" }).expect(200);
    });

    it("verlangt eine Begruendung und haelt sie in der Version fest", async () => {
      await mitBedingungen([{ art: "begruendung", mindestlaenge: 10 }]);
      await anlegen("F-6");

      await mit(alsMensch)("put", zustand("F-6")).send({ toState: "in_pruefung" }).expect(409);

      await mit(alsMensch)("put", zustand("F-6"))
        .send({ toState: "in_pruefung", reason: "Fachlich abgestimmt mit dem Bereich" })
        .expect(200);

      const { rows } = await pool.query<{ change_reason: string | null }>(
        "SELECT change_reason FROM requirement_history ORDER BY version DESC LIMIT 1",
      );

      expect(rows[0]?.change_reason).toContain("abgestimmt");
    });

    describe("Vorbehalt", () => {
      const abSchwelle = () =>
        mitBedingungen([
          {
            art: "rolle",
            eineVon: ["platform-admin"],
            nurWenn: [{ feld: "kostenschaetzung", operator: "mindestens", wert: 50000 }],
          },
        ]);

      beforeEach(async () => {
        await registriereAttribut(pool, { key: "kostenschaetzung", dataType: "number" });
      });

      it("prueft nicht, wenn der Vorbehalt nicht greift", async () => {
        await abSchwelle();
        await anlegen("G-1");

        await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/G-1")
          .send({ dynamicAttributes: { kostenschaetzung: 1000 } })
          .expect(200);

        await mit(alsMensch)("put", zustand("G-1")).send({ toState: "in_pruefung" }).expect(200);
      });

      it("prueft, wenn er greift", async () => {
        await abSchwelle();
        await anlegen("G-2");

        await mit(alsMensch)("patch", "/v1/requirements/by-source/sap/G-2")
          .send({ dynamicAttributes: { kostenschaetzung: 80000 } })
          .expect(200);

        await mit(alsMensch)("put", zustand("G-2")).send({ toState: "in_pruefung" }).expect(409);
      });

      it("weist ab, wenn der Vorbehalt nicht auswertbar ist", async () => {
        await abSchwelle();
        await anlegen("G-3");

        // Kein Wert gesetzt - weder anwenden noch ueberspringen waere begruendbar.
        const antwort = await mit(alsMensch)("put", zustand("G-3"))
          .send({ toState: "in_pruefung" })
          .expect(409);

        expect(antwort.body.conditions[0].message).toContain("Vorbehalt");
      });
    });
  });
  describe("Zulaessige Uebergaenge (M4.5)", () => {
    const mitBedingungen = (bedingungen: unknown[]) =>
      registriereWorkflow(pool, null, {
        transitions: [
          { from: "neu", to: "in_pruefung", label: "Einreichen", bedingungen },
          { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
        ],
      });

    const uebergaenge = (externalId: string) =>
      `/v1/requirements/by-source/sap/${externalId}/transitions`;

    it("nennt nur die Uebergaenge aus dem aktuellen Zustand", async () => {
      await registriereWorkflow(pool);
      await anlegen("H-1");

      const antwort = await mit(alsMensch)("get", uebergaenge("H-1")).expect(200);

      expect(antwort.body.currentState).toBe("neu");
      expect(antwort.body.currentStateInWorkflow).toBe(true);
      expect(antwort.body.transitions).toEqual([
        {
          toState: "in_pruefung",
          label: "Einreichen",
          allowed: true,
          blockedBy: [],
          requiresReason: false,
        },
      ]);
    });

    it("liefert im Endzustand keine Uebergaenge", async () => {
      await registriereWorkflow(pool);
      await anlegen("H-2");
      await mit(alsMensch)("put", zustand("H-2")).send({ toState: "in_pruefung" }).expect(200);
      await mit(alsMensch)("put", zustand("H-2")).send({ toState: "erledigt" }).expect(200);

      const antwort = await mit(alsMensch)("get", uebergaenge("H-2")).expect(200);

      // Leere Liste **und** currentStateInWorkflow true - fertig, nicht haengengeblieben.
      expect(antwort.body).toMatchObject({
        currentState: "erledigt",
        currentStateInWorkflow: true,
      });
      expect(antwort.body.transitions).toEqual([]);
    });

    it("nennt einen gesperrten Uebergang mit Begruendung", async () => {
      await mitBedingungen([{ art: "rolle", eineVon: ["platform-admin"] }]);
      await anlegen("H-3");

      const antwort = await mit(alsMensch)("get", uebergaenge("H-3")).expect(200);

      expect(antwort.body.transitions[0]).toMatchObject({ toState: "in_pruefung", allowed: false });
      expect(antwort.body.transitions[0].blockedBy).toHaveLength(1);
      expect(antwort.body.transitions[0].blockedBy[0].kind).toBe("rolle");
    });

    it("haengt vom Anmeldenden ab", async () => {
      await mitBedingungen([{ art: "rolle", eineVon: ["platform-admin"] }]);
      await anlegen("H-4");

      const ohne = await mit(alsMensch)("get", uebergaenge("H-4")).expect(200);
      const mitRolle = await mit(alsAdmin)("get", uebergaenge("H-4")).expect(200);

      // Der Grund, aus dem die Oberflaeche das nicht selbst ausrechnen kann - und aus dem
      // die Antwort nicht zwischen Anwendern zwischengespeichert werden darf.
      expect(ohne.body.transitions[0].allowed).toBe(false);
      expect(mitRolle.body.transitions[0].allowed).toBe(true);
    });

    it("fuehrt mehrere Gruende einzeln auf", async () => {
      await registriereAttribut(pool, { key: "abweichungsbegruendung" });
      await mitBedingungen([
        { art: "rolle", eineVon: ["platform-admin"] },
        { art: "pflichtfelder", felder: ["abweichungsbegruendung"] },
      ]);
      await anlegen("H-5");

      const antwort = await mit(alsMensch)("get", uebergaenge("H-5")).expect(200);

      expect(
        antwort.body.transitions[0].blockedBy.map((e: { kind: string }) => e.kind).sort(),
      ).toEqual(["pflichtfelder", "rolle"]);
    });

    it("zaehlt eine fehlende Begruendung nicht als Hinderungsgrund", async () => {
      await mitBedingungen([{ art: "begruendung", mindestlaenge: 10 }]);
      await anlegen("H-6");

      const antwort = await mit(alsMensch)("get", uebergaenge("H-6")).expect(200);

      // Die Begruendung entsteht erst beim Ausloesen. Waere sie ein Hinderungsgrund,
      // erschiene der Uebergang als gesperrt und die Oberflaeche muesste `allowed`
      // ignorieren.
      expect(antwort.body.transitions[0]).toMatchObject({
        allowed: true,
        blockedBy: [],
        requiresReason: true,
      });
    });

    it("meldet einen Zustand, den der Graph nicht kennt", async () => {
      await registriereWorkflow(pool);
      await anlegen("H-7");
      await pool.query("UPDATE requirement SET status = 'freigegeben' WHERE external_id = $1", [
        "H-7",
      ]);

      const antwort = await mit(alsMensch)("get", uebergaenge("H-7")).expect(200);

      // Leere Liste **und** currentStateInWorkflow false - haengengeblieben, nicht fertig.
      // Genau diese Unterscheidung kann die Oberflaeche sonst nicht treffen.
      expect(antwort.body).toMatchObject({
        currentState: "freigegeben",
        currentStateInWorkflow: false,
      });
      expect(antwort.body.transitions).toEqual([]);
    });

    it("liefert bei einem fremdgefuehrten Workflow nichts an", async () => {
      await registriereWorkflow(pool, null, {
        mode: "external",
        initialState: "offen",
        states: [
          { key: "offen", label: "Offen" },
          { key: "geschlossen", label: "Geschlossen" },
        ],
        transitions: [],
      });
      await anlegen("H-8");

      const antwort = await mit(alsMensch)("get", uebergaenge("H-8")).expect(200);

      expect(antwort.body.transitions).toEqual([]);
    });

    it("weist eine unbekannte Herkunft mit 404 ab", async () => {
      await registriereWorkflow(pool);

      await mit(alsMensch)("get", uebergaenge("gibt-es-nicht")).expect(404);
    });
  });

  describe("Eigene Erfassung ohne externen Bezeichner", () => {
    /**
     * **Die Luecke, die M4.5 aufgedeckt hat.** Saemtliche uebrigen Faelle arbeiten mit
     * `sourceSystem: "sap"` und einem externen Bezeichner - der Importweg war durchgaengig
     * geprueft, die eigene Erfassung nie. Sie hat bewusst kein `externalId` (§19.1) und ist
     * ueber `by-source` deshalb ueberhaupt nicht adressierbar.
     */
    async function eigeneAnforderung() {
      const antwort = await mit(alsMensch)("post", "/v1/requirements")
        .send({
          projectId: "11111111-1111-4111-8111-111111111111",
          requirementType: "feature",
          owner: "M. Weber",
        })
        .expect(201);

      return antwort.body as { id: string; sourceSystem: string; externalId: string | null };
    }

    it("legt ohne externen Bezeichner an", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      expect(angelegt).toMatchObject({ sourceSystem: "infrademand", externalId: null });
    });

    it("nennt ihre Uebergaenge ueber die Kennung", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      const antwort = await mit(alsMensch)(
        "get",
        `/v1/requirements/${angelegt.id}/transitions`,
      ).expect(200);

      expect(antwort.body.currentState).toBe("neu");
      expect(antwort.body.transitions[0]).toMatchObject({ toState: "in_pruefung", allowed: true });
    });

    it("nennt die Zustaende der gebundenen Fassung", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      const antwort = await mit(alsMensch)(
        "get",
        `/v1/requirements/${angelegt.id}/transitions`,
      ).expect(200);

      // Die Auswahl fuer die Zuordnung - gerade dann noetig, wenn `transitions` leer ist.
      expect(antwort.body.states.map((zustand: { key: string }) => zustand.key)).toEqual([
        "neu",
        "in_pruefung",
        "erledigt",
      ]);
    });

    it("wechselt den Zustand ueber die Kennung", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      const gewechselt = await mit(alsMensch)("put", `/v1/requirements/${angelegt.id}/state`)
        .send({ toState: "in_pruefung" })
        .expect(200);

      expect(gewechselt.body).toMatchObject({ status: "in_pruefung", version: 2 });
    });

    it("prueft ueber die Kennung dieselben Bedingungen", async () => {
      // Zwei Zugaenge, ein Pruefpfad - sonst waere der Kennungsweg eine Umgehung.
      await registriereWorkflow(pool, null, {
        transitions: [
          {
            from: "neu",
            to: "in_pruefung",
            label: "Einreichen",
            bedingungen: [{ art: "rolle", eineVon: ["platform-admin"] }],
          },
          { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
        ],
      });
      const angelegt = await eigeneAnforderung();

      const antwort = await mit(alsMensch)("put", `/v1/requirements/${angelegt.id}/state`)
        .send({ toState: "in_pruefung" })
        .expect(409);

      expect(antwort.body.conditions[0].kind).toBe("rolle");
    });

    it("ordnet ueber die Kennung einen Zustand zu", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();
      await pool.query("UPDATE requirement SET status = 'freigegeben' WHERE id = $1", [
        angelegt.id,
      ]);

      // Genau der Fall, den die Oberflaeche seit M4.5 anzeigt - und fuer den es bis M4.6
      // keinen Knopf gab.
      const antwort = await mit(alsAdmin)("put", `/v1/requirements/${angelegt.id}/state/assignment`)
        .send({ state: "neu", reason: "Altbestand, zurueck auf den Anfangszustand" })
        .expect(200);

      expect(antwort.body.status).toBe("neu");
    });

    it("hebt ueber die Kennung auf die aktuelle Fassung", async () => {
      const workflow = await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      await mit(alsAdmin)("put", `/v1/workflow-definitions/${workflow.id}`)
        .send({
          label: "Zweite Fassung",
          mode: "internal",
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
          active: true,
        })
        .expect(200);

      const gehoben = await mit(alsAdmin)("put", `/v1/requirements/${angelegt.id}/workflow-version`)
        .send({ reason: "Auf den heutigen Stand gebracht" })
        .expect(200);

      expect(gehoben.body.workflow.version).toBe(2);
    });

    it("weist die Zuordnung ohne platform-admin auch ueber die Kennung ab", async () => {
      await registriereWorkflow(pool);
      const angelegt = await eigeneAnforderung();

      // Der Kennungsweg darf keine Umgehung sein - auch nicht bei der Berechtigung.
      await mit(alsMensch)("put", `/v1/requirements/${angelegt.id}/state/assignment`)
        .send({ state: "neu", reason: "Ohne Berechtigung versucht" })
        .expect(403);
    });

    it("weist eine unbekannte Kennung mit 404 ab", async () => {
      await registriereWorkflow(pool);

      await mit(alsMensch)(
        "get",
        "/v1/requirements/11111111-1111-4111-8111-111111111111/transitions",
      ).expect(404);
    });
  });
});
