import { decodeJwt } from "jose";
import * as client from "openid-client";
import { holeKonfiguration, loeseQuelleAuf } from "@/lib/auth/identitaetsquellen";
import { holeSitzung, verwerfeAnmeldezustand } from "@/lib/auth/sitzung";
import { anwendungsBasisUrl } from "@/lib/auth/umgebung";

/** Rollen stehen bei Keycloak im Zugriffstoken, nicht im ID-Token. */
function realmRollen(zugriffstoken: string): string[] {
  const inhalt = decodeJwt(zugriffstoken) as {
    realm_access?: { roles?: unknown };
  };
  const rollen = inhalt.realm_access?.roles;
  return Array.isArray(rollen) ? rollen.filter((r) => typeof r === "string") : [];
}

export async function GET(anfrage: Request): Promise<Response> {
  const sitzung = await holeSitzung();
  const { pkceVerifier, state, nonce, quelle: quellenAlias } = sitzung;

  if (pkceVerifier === undefined || state === undefined || nonce === undefined) {
    // Kein Anmeldezustand: abgelaufenes Cookie, doppelt geoeffneter Tab oder ein
    // untergeschobener Rueckruf. In allen drei Faellen ist Neubeginn die Antwort.
    return Response.redirect(`${anwendungsBasisUrl()}/?fehler=abgelaufen`, 302);
  }

  const rueckkehrZiel = sitzung.rueckkehrZiel ?? "/";
  const quelle = loeseQuelleAuf(quellenAlias);
  const konfiguration = await holeKonfiguration(quelle);

  // Die aufgerufene Adresse wird aus APP_BASE_URL neu gebildet, nicht aus
  // anfrage.url uebernommen: Hinter einem Reverse Proxy traegt anfrage.url das
  // interne Schema und den internen Namen, und die Pruefung schluege fehl.
  const aufgerufeneUrl = new URL(`${anwendungsBasisUrl()}/api/auth/callback`);
  aufgerufeneUrl.search = new URL(anfrage.url).search;

  let token: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    token = await client.authorizationCodeGrant(konfiguration, aufgerufeneUrl, {
      pkceCodeVerifier: pkceVerifier,
      expectedState: state,
      expectedNonce: nonce,
      idTokenExpected: true,
    });
  } catch {
    // Die Ursache gehoert ins Protokoll, nicht in die Antwort (PROD-034).
    sitzung.destroy();
    return Response.redirect(`${anwendungsBasisUrl()}/?fehler=anmeldung`, 302);
  }

  const anspruch = token.claims();
  const gueltigkeit = token.expiresIn();

  verwerfeAnmeldezustand(sitzung);
  sitzung.zugriffstoken = token.access_token;
  sitzung.erneuerungstoken = token.refresh_token;
  sitzung.gueltigBis = gueltigkeit === undefined ? undefined : Date.now() + gueltigkeit * 1000;
  sitzung.subjekt = anspruch?.sub;
  sitzung.benutzername =
    typeof anspruch?.["preferred_username"] === "string"
      ? anspruch["preferred_username"]
      : undefined;
  sitzung.anzeigename = typeof anspruch?.["name"] === "string" ? anspruch["name"] : undefined;
  sitzung.rollen = realmRollen(token.access_token);
  await sitzung.save();

  return Response.redirect(`${anwendungsBasisUrl()}${rueckkehrZiel}`, 302);
}
