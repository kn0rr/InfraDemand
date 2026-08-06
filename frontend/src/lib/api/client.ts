import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Typsicherer Client fuer den Requirement-Service.
 *
 * Er spricht **den BFF** an, nicht den Service unmittelbar: Im Browser liegt kein
 * Token (ADR-0014), die Weiterleitung ergaenzt es serverseitig. Die Pfade stammen aus
 * dem eingecheckten Contract - `/v1/requirements` hier ist derselbe Pfad wie dort.
 *
 * Ohne `ursprung` ist die Basisadresse relativ, was im Browser genuegt. Aus einer
 * Server Component heraus gibt es keinen Ursprung; dort muss er mitgegeben werden.
 */
export function requirementClient(ursprung = ""): ReturnType<typeof createClient<paths>> {
  return createClient<paths>({ baseUrl: `${ursprung}/api/requirement` });
}
