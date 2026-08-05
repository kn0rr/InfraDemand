import { Inject, Injectable } from "@nestjs/common";
import { asc } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.tokens";
import { type RequirementRow, requirements } from "../database/schema";

@Injectable()
export class RequirementsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  findAll(): Promise<RequirementRow[]> {
    return this.db.select().from(requirements).orderBy(asc(requirements.createdAt));
  }
}
