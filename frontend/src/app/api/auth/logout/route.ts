import * as client from "openid-client";
import { holeKonfiguration, loeseQuelleAuf } from "@/lib/auth/identitaetsquellen";
import { holeSitzung } from "@/lib/auth/sitzung.server";
import { anwendungsBasisUrl } from "@/lib/auth/umgebung";

export async function POST(): Promise<Response> {
  const sitzung = await holeSitzung();
  const quelle = loeseQuelleAuf(sitzung.quelle);
  sitzung.destroy();

  const konfiguration = await holeKonfiguration(quelle);

  // Ohne id_token_hint verlangt Keycloak client_id, und die Rueckkehradresse muss
  // am Client registriert sein (ToDo 2). Das ID-Token bewusst nicht aufzubewahren
  // spart rund 1 KB im Cookie - siehe PROD-045.
  const ziel = client.buildEndSessionUrl(konfiguration, {
    client_id: quelle.clientId,
    post_logout_redirect_uri: `${anwendungsBasisUrl()}/`,
  });

  return Response.redirect(ziel.href, 303);
}
