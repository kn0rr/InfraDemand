import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export const DATABASE = Symbol("DATABASE");
export const DATABASE_POOL = Symbol("DATABASE_POOL");

export type Database = NodePgDatabase<typeof schema>;
