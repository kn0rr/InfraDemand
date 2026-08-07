import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { type SourceSystemRow, sourceSystems } from "../database/schema";

@Injectable()
export class SourceSystemsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByKey(key: string): Promise<SourceSystemRow | undefined> {
    const [zeile] = await this.db
      .select()
      .from(sourceSystems)
      .where(eq(sourceSystems.key, key))
      .limit(1);

    return zeile;
  }
  findAll(): Promise<SourceSystemRow[]> {
    return this.db.select().from(sourceSystems);
  }
}
