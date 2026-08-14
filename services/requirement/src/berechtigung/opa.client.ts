import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { deuteAntwort, type Sichtbarkeit } from "./sichtbarkeit.typen";

/** Der eine freigegebene Auswertungspfad (siehe policies/authz.rego). */
const PFAD = "/v1/compile/anforderungen/sichtbarkeit/sichtbar";

/**
 * Die unbekannte Groesse. Ihr Name erscheint unveraendert im Ergebnis und verweist damit
 * auf Tabelle und Spalte - er ist an das Schema gebunden und nicht frei waehlbar.
 */
const UNBEKANNT = ["input.requirement"];

@Injectable()
export class OpaClient {
  private readonly logger = new Logger(OpaClient.name);
  private readonly basis: string;
  private readonly zeitgrenzeMs: number;

  constructor(config: ConfigService) {
    this.basis = config.getOrThrow<string>("OPA_URL");
    this.zeitgrenzeMs = Number(config.get("OPA_TIMEOUT_MS") ?? 2000);
  }

  /**
   * Fragt, welche Anforderungen dieser Anwender sehen darf.
   *
   * **Ein Ausfall wirft und liefert kein `nichts`.** Der Unterschied ist wesentlich:
   * „nichts sichtbar" ist eine gueltige Auskunft der Richtlinie, ein Ausfall ist keine.
   * Beides in denselben Rueckgabewert zu legen hiesse, eine leere Liste anzuzeigen, wo
   * die Berechtigungspruefung nicht laeuft - der Anwender haelt den Bestand fuer leer
   * und niemand erfaehrt vom Ausfall. Fail-closed heisst abgelehnt, nicht falsch
   * beantwortet (ADR-0028 Punkt 5).
   */
  async sichtbarkeit(benutzer: AuthenticatedUser): Promise<Sichtbarkeit> {
    const eingabe = {
      input: { benutzer: { mandanten: benutzer.tenants } },
      unknowns: UNBEKANNT,
    };

    let rumpf: unknown;

    try {
      const antwort = await fetch(`${this.basis}${PFAD}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Ohne diese Kopfzeile kommt der Rego-Syntaxbaum statt einer Bedingung.
          accept: "application/vnd.opa.ucast.all+json",
        },
        body: JSON.stringify(eingabe),
        signal: AbortSignal.timeout(this.zeitgrenzeMs),
      });

      if (!antwort.ok) {
        throw new Error(`Auswertung antwortete mit ${antwort.status}`);
      }

      rumpf = await antwort.json();
    } catch (fehler) {
      this.logger.error(`Auswertung nicht moeglich: ${String(fehler)}`);
      throw new ServiceUnavailableException("Berechtigungspruefung nicht verfuegbar");
    }

    const sichtbarkeit = deuteAntwort(rumpf);

    // Ohne diese Zeile ist „auditierbar" aus §8 eine Behauptung. Die Ablage im
    // eigentlichen Auditpfad ist als Folgeentscheidung von ADR-0028 gefuehrt.
    this.logger.log(
      `Sichtbarkeit fuer ${benutzer.userId}: ${sichtbarkeit.art} (Mandanten: ${benutzer.tenants.join(",") || "keine"})`,
    );

    return sichtbarkeit;
  }
}
