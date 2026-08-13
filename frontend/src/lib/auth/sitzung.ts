import type { SessionOptions } from "iron-session";
import { erforderlich } from "./umgebung";

/**
 * Inhalt des Sitzungscookies.
 *
 * Alles hier landet verschluesselt im Browser und zaehlt gegen die 4096-Byte-Grenze
 * eines Cookies (PROD-045). Jedes zusaetzliche Feld braucht einen Grund.
 */
export interface Sitzungsinhalt {
  /** Aus welcher Identitaetsquelle die Anmeldung stammt (ADR-0015). */
  quelle?: string;

  // --- nur zwischen Anmeldebeginn und Rueckruf gesetzt ---
  pkceVerifier?: string;
  state?: string;
  nonce?: string;
  rueckkehrZiel?: string;

  // --- nach erfolgreicher Anmeldung ---
  zugriffstoken?: string;
  erneuerungstoken?: string;
  /** Ablauf des Zugriffstokens, Millisekunden seit Epoche. */
  gueltigBis?: number;
  subjekt?: string;
  benutzername?: string;
  anzeigename?: string;
  /**
   * Ausschliesslich zur Darstellung. Durchgesetzt werden Rechte im jeweiligen
   * Service gegen das Token - nie hier. Der BFF ist kein Berechtigungspunkt (§8).
   */
  rollen?: string[];

  /**
   * Mandanten, denen der Anwender angehoert (ADR-0026 Punkt 6).
   *
   * Wie `rollen` ausschliesslich zur Darstellung: Das Anlegeformular braucht eine Auswahl,
   * und die Zugehoerigkeiten stehen im Token, das der Browser nie sieht. Durchgesetzt wird
   * gegen das Token im Service - die Vorwahl hier kann nichts freigeben (ADR-0026 Punkt 2).
   */
  mandanten?: string[];
}

export const SITZUNGSDAUER_SEKUNDEN = 60 * 60 * 8;

/**
 * Die Optionen werden je Anfrage gebildet, nicht beim Laden des Moduls.
 *
 * Next wertet Route-Module beim Bauen aus ("Collecting page data"), um statische
 * von dynamischen Routen zu trennen. Eine Modulkonstante, die die Umgebung liest,
 * wird dabei ausgefuehrt - und laesst den Build ueberall scheitern, wo die Werte
 * nicht stehen. Das ist in der CI der Normalfall und soll es bleiben:
 * Konfiguration gehoert zur Anfrage, nicht ins Bauergebnis.
 */
export function sitzungsOptionen(): SessionOptions {
  return {
    password: erforderlich("SESSION_PASSWORD"),
    cookieName: "infrademand_sitzung",
    ttl: SITZUNGSDAUER_SEKUNDEN,
    cookieOptions: {
      httpOnly: true,
      // Bleibt auch lokal gesetzt: Browser behandeln localhost als sicheren Kontext.
      // Die verbreitete Abschwaechung `secure: NODE_ENV === "production"` wird nie
      // wieder geprueft - und faellt genau dann auf, wenn sie schadet.
      secure: true,
      // "lax" ist erforderlich, nicht bequem: Der Rueckruf von Keycloak ist eine
      // seitenuebergreifende Navigation der obersten Ebene. Bei "strict" schickt der
      // Browser das Cookie dabei nicht mit - PKCE-Verifier und state waeren verloren,
      // und jede Anmeldung schluege fehl.
      sameSite: "lax",
      path: "/",
    },
  };
}

/** Entfernt die nur waehrend des Anmeldeflusses benoetigten Felder. */
export function verwerfeAnmeldezustand(sitzung: Sitzungsinhalt): void {
  delete sitzung.pkceVerifier;
  delete sitzung.state;
  delete sitzung.nonce;
  delete sitzung.rueckkehrZiel;
}

export function istAngemeldet(sitzung: Sitzungsinhalt): boolean {
  return sitzung.subjekt !== undefined;
}
/**
 * Prueft ein Rueckkehrziel, bevor es in die Sitzung geschrieben wird.
 *
 * Zugelassen ist ausschliesslich ein Pfad innerhalb der Anwendung. `//example.org`
 * ist protokollrelativ und waere eine offene Weiterleitung - deshalb die zweite
 * Bedingung.
 */
export function sicheresRueckkehrZiel(kandidat: string | null): string {
  if (kandidat === null) return "/";
  if (!kandidat.startsWith("/")) return "/";
  if (kandidat.startsWith("//")) return "/";
  return kandidat;
}
