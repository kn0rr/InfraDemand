import type { IronSession } from "iron-session";
import * as client from "openid-client";
import { holeKonfiguration, loeseQuelleAuf } from "./identitaetsquellen";
import type { Sitzungsinhalt } from "./sitzung";

/**
 * Sicherheitsabstand vor dem Ablauf.
 *
 * Ein Token, das in 30 Sekunden ablaeuft, wird erneuert statt benutzt. Ohne diesen
 * Abstand kann es zwischen der Pruefung hier und der Ankunft beim Service ablaufen -
 * der Fehler waere ein sporadisches 401, das sich nicht nachstellen laesst.
 */
const ABSTAND_MS = 30_000;

/**
 * Liefert ein gueltiges Zugriffstoken, oder `undefined`, wenn die Sitzung nicht mehr
 * traegt.
 *
 * **Nur aus Route-Handlern aufrufen.** Die Funktion schreibt die Sitzung fort, und
 * Cookies lassen sich ausserhalb von Route-Handlern und Server Actions nicht setzen.
 *
 * Gleichzeitige Anfragen erneuern jede fuer sich; eine Absprache gibt es nicht
 * (PROD-047).
 */
export async function frischesZugriffstoken(
  sitzung: IronSession<Sitzungsinhalt>,
): Promise<string | undefined> {
  const { zugriffstoken, erneuerungstoken } = sitzung;
  if (zugriffstoken === undefined || erneuerungstoken === undefined) {
    return undefined;
  }

  if ((sitzung.gueltigBis ?? 0) - ABSTAND_MS > Date.now()) {
    return zugriffstoken;
  }

  const konfiguration = await holeKonfiguration(loeseQuelleAuf(sitzung.quelle));

  try {
    const token = await client.refreshTokenGrant(konfiguration, erneuerungstoken);
    const gueltigkeit = token.expiresIn();

    sitzung.zugriffstoken = token.access_token;
    // Keycloak gibt bei jeder Erneuerung ein neues Erneuerungstoken aus. Wird es nicht
    // uebernommen, endet die Sitzung mit dem Ablauf des alten - und zwar erst Stunden
    // spaeter, was den Zusammenhang schwer erkennbar macht.
    if (token.refresh_token !== undefined) {
      sitzung.erneuerungstoken = token.refresh_token;
    }
    sitzung.gueltigBis = gueltigkeit === undefined ? undefined : Date.now() + gueltigkeit * 1000;
    await sitzung.save();

    return token.access_token;
  } catch {
    // Erneuerungstoken abgelaufen, widerrufen, oder die Sitzung wurde in Keycloak
    // beendet. In jedem Fall ist die Sitzung hier wertlos. Die Ursache gehoert ins
    // Protokoll, nicht in die Antwort (PROD-034).
    sitzung.destroy();
    return undefined;
  }
}
