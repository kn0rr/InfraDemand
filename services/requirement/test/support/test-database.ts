import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export interface TestDatabase {
  connectionString: string;
  stop(): Promise<void>;
}

/**
 * Startet eine echte PostgreSQL-Instanz und wendet die Migrationen an (ADR-0008).
 * Keine Attrappe und kein In-Memory-Ersatz: Genau das JSONB-Verhalten, auf dem §6
 * aufbaut, bildet kein anderes System nach.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("requirement")
    .withUsername("requirement")
    .withPassword("requirement")
    .start();

  const connectionString = container.getConnectionUri();
  const pool = new Pool({ connectionString });

  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }

  return {
    connectionString,
    stop: async () => {
      await container.stop();
    },
  };
}
