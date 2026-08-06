import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Kein Rueckfallwert: Die Verbindung kommt aus infra/local/local.env, geladen ueber
    // das Skript db:migrate. Ein zweiter hartkodierter Wert waere eine stille Doppelung.
    url: process.env["DATABASE_URL"] ?? "",
  },
});
