import * as client from "openid-client";
import { erforderlich } from "./umgebung";

/** Eine Identitaetsquelle nach ADR-0015. */
export interface Identitaetsquelle {
  readonly alias: string;
  readonly ausstellerUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export const STANDARD_QUELLE = "infrademand";

/**
 * ADR-0015 Punkt 3: Kein Code setzt voraus, dass es genau einen Aussteller gibt.
 *
 * Heute hat die Registratur genau einen Eintrag. Die Auswahl laeuft trotzdem schon
 * ueber eine Auflösung statt ueber eine Konstante - kommt eine zweite Quelle mit
 * eigenem Aussteller hinzu, waechst diese Map, und kein Aufrufer aendert sich.
 */
function registratur(): ReadonlyMap<string, Identitaetsquelle> {
  return new Map([
    [
      STANDARD_QUELLE,
      {
        alias: STANDARD_QUELLE,
        ausstellerUrl: erforderlich("KEYCLOAK_ISSUER_URL"),
        clientId: erforderlich("FRONTEND_CLIENT_ID"),
        clientSecret: erforderlich("FRONTEND_CLIENT_SECRET"),
      },
    ],
  ]);
}

export function loeseQuelleAuf(alias: string | undefined): Identitaetsquelle {
  const gesucht = alias ?? STANDARD_QUELLE;
  const quelle = registratur().get(gesucht);
  if (quelle === undefined) {
    throw new Error(`Unbekannte Identitaetsquelle: ${gesucht}`);
  }
  return quelle;
}

const zwischenspeicher = new Map<string, Promise<client.Configuration>>();

/**
 * Beschafft das Erkennungsdokument und haelt es je Quelle vor.
 *
 * Zwischengespeichert wird das Versprechen, nicht das Ergebnis - dadurch fuehren
 * gleichzeitige Anfragen zu genau einem Abruf. Schlaegt der Abruf fehl, wird der
 * Eintrag verworfen: ein Keycloak, der beim ersten Zugriff noch nicht bereit war,
 * wuerde die Anwendung sonst bis zum Neustart unbrauchbar machen.
 */
export function holeKonfiguration(quelle: Identitaetsquelle): Promise<client.Configuration> {
  const vorhanden = zwischenspeicher.get(quelle.alias);
  if (vorhanden !== undefined) {
    return vorhanden;
  }

  const aussteller = new URL(quelle.ausstellerUrl);

  // Nur fuer die lokale Umgebung: Keycloak laeuft dort ueber http. Die Bedingung
  // haengt am Schema der Ausstelleradresse, nicht an einem Schalter - eine Umgebung
  // mit https-Aussteller kann diesen Zweig gar nicht erreichen, und es gibt keine
  // Variable, die jemand versehentlich produktiv setzen koennte.
  const nachbehandlung = aussteller.protocol === "http:" ? [client.allowInsecureRequests] : [];

  const laufend = client
    .discovery(aussteller, quelle.clientId, quelle.clientSecret, undefined, {
      execute: nachbehandlung,
    })
    .catch((fehler: unknown) => {
      zwischenspeicher.delete(quelle.alias);
      throw fehler;
    });

  zwischenspeicher.set(quelle.alias, laufend);
  return laufend;
}
