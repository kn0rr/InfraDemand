import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { requirements } from "../src/database/schema";
import { startTestDatabase, type TestDatabase } from "./support/test-database";

/**
 * Sichert die Semantik der Eindeutigkeit aus §19.1 ab. Die NULL-Behandlung ist subtil
 * genug, dass sie festgeschrieben gehoert: Ohne diese Tests waere eine spaetere
 * Umstellung auf NULLS NOT DISTINCT eine stille Verhaltensaenderung.
 */
describe("Eindeutigkeit von Herkunft und externem Bezeichner", () => {
  let database: TestDatabase;
  let pool: Pool;

  const basis = {
    projectId: "11111111-1111-4111-8111-111111111111",
    requirementType: "feature",
    status: "neu",
    owner: "test.author",
  };

  beforeAll(async () => {
    database = await startTestDatabase();
    pool = new Pool({ connectionString: database.connectionString });
  });

  afterAll(async () => {
    await pool.end();
    await database.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE requirement");
  });

  it("erlaubt mehrere eigene Datensaetze ohne externen Bezeichner", async () => {
    const db = drizzle(pool);

    await db.insert(requirements).values({ ...basis, sourceSystem: "infrademand" });
    await db.insert(requirements).values({ ...basis, sourceSystem: "infrademand" });

    const alle = await db.select().from(requirements);
    expect(alle).toHaveLength(2);
  });

  it("weist denselben externen Bezeichner aus derselben Quelle zurueck", async () => {
    const db = drizzle(pool);

    await db.insert(requirements).values({ ...basis, sourceSystem: "sap", externalId: "A-1" });

    await expect(
      db.insert(requirements).values({ ...basis, sourceSystem: "sap", externalId: "A-1" }),
    ).rejects.toThrow();
  });

  it("erlaubt denselben externen Bezeichner aus verschiedenen Quellen", async () => {
    const db = drizzle(pool);

    await db.insert(requirements).values({ ...basis, sourceSystem: "sap", externalId: "A-1" });
    await db
      .insert(requirements)
      .values({ ...basis, sourceSystem: "servicenow", externalId: "A-1" });

    const alle = await db.select().from(requirements);
    expect(alle).toHaveLength(2);
  });

  it("setzt infrademand als Herkunft, wenn nichts angegeben ist", async () => {
    const db = drizzle(pool);

    await db.insert(requirements).values(basis);

    const [zeile] = await db.select().from(requirements);
    expect(zeile?.sourceSystem).toBe("infrademand");
  });
});
