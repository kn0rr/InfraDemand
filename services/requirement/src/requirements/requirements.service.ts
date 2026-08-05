import { Injectable } from "@nestjs/common";
import type { RequirementRow } from "../database/schema";
import type { RequirementResponse } from "./requirement.dto";
import { RequirementsRepository } from "./requirements.repository";

@Injectable()
export class RequirementsService {
  constructor(private readonly repository: RequirementsRepository) {}

  async findAll(): Promise<RequirementResponse[]> {
    const rows = await this.repository.findAll();
    return rows.map(RequirementsService.toResponse);
  }

  private static toResponse(row: RequirementRow): RequirementResponse {
    return {
      id: row.id,
      projectId: row.projectId,
      requirementType: row.requirementType,
      status: row.status,
      owner: row.owner,
      dynamicAttributes: row.dynamicAttributes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      version: row.version,
    };
  }
}
