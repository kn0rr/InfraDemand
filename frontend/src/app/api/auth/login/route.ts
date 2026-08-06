import * as client from "openid-client";
import { holeKonfiguration, loeseQuelleAuf } from "@/lib/auth/identitaetsquellen";
import { holeSitzung, sicheresRueckkehrZiel } from "@/lib/auth/sitzung";
import { rueckrufUrl } from "@/lib/auth/umgebung";

export async function GET(anfrage: Request): Promise<Response> {
  const url = new URL(anfrage.url);

  // ADR-0015 Punkt 2: Ist die Zielquelle bereits bekannt, ueberspringt kc_idp_hint
  // die Auswahlseite von Keycloak. Ohne Angabe zeigt Keycloak die Auswahl selbst.
  const quelle = loeseQuelleAuf(url.searchParams.get("quelle") ?? undefined);
  const konfiguration = await holeKonfiguration(quelle);
  const idpHinweis = url.searchParams.get("idp");

  const pkceVerifier = client.randomPKCECodeVerifier();
  const pkceChallenge = await client.calculatePKCECodeChallenge(pkceVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const sitzung = await holeSitzung();
  sitzung.quelle = quelle.alias;
  sitzung.pkceVerifier = pkceVerifier;
  sitzung.state = state;
  sitzung.nonce = nonce;
  sitzung.rueckkehrZiel = sicheresRueckkehrZiel(url.searchParams.get("ziel"));
  await sitzung.save();

  const ziel = client.buildAuthorizationUrl(konfiguration, {
    redirect_uri: rueckrufUrl(),
    scope: "openid profile email",
    code_challenge: pkceChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
    ...(idpHinweis === null ? {} : { kc_idp_hint: idpHinweis }),
  });

  return Response.redirect(ziel.href, 302);
}
