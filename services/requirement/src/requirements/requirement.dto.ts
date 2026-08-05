/**
 * API-Darstellung. Bewusst getrennt von der Datenbankzeile: Persistenzdetails duerfen
 * nicht in den Vertrag lecken (§2), und ab M1.4 entsteht der OpenAPI-Contract aus
 * genau diesem Typ.
 */
export interface RequirementResponse {
  id: string;
  projectId: string;
  requirementType: string;
  status: string;
  owner: string;
  dynamicAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}
