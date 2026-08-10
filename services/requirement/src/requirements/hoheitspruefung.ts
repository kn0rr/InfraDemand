import type { MastershipRuleRow } from "../database/schema";
import { istGleich } from "./feldherkunft";

export type Quellenklasse = "automatic" | "manual";
export type Hoheitsmodus = MastershipRuleRow["mode"];

/** Ein Feld, das eine Schreiboperation setzen will. */
export interface Feldvorhaben {
  field: string;
  neuerWert: unknown;
  aktuellerWert: unknown;
  /** Klasse der Quelle, die den aktuellen Wert gesetzt hat. Leer, wenn es keinen gibt. */
  aktuelleQuellenklasse: Quellenklasse | undefined;
}

export interface Abweisung {
  field: string;
  reason: Exclude<MastershipRuleRow["mode"], "manual_allowed">;
  rejectedValue: unknown;
  message: string;
}

/**
 * Entscheidet je Feld, ob eine Schreiboperation es setzen darf (§19.3, ADR-0017 A2).
 *
 * **Nur Aenderungen zaehlen.** Ein Feld, dessen Wert gleich bleibt, wird nie abgewiesen.
 * Sonst schluege ein Formular fehl, das seine Felder vollstaendig zurueckschickt, obwohl
 * der Anwender das gesperrte Feld nicht angefasst hat - und die Regeln waeren in der
 * Oberflaeche unbenutzbar.
 *
 * **Die Regeln beschraenken ausschliesslich manuelle Quellen.** Eine automatische Quelle
 * wird hier nie abgewiesen; dagegen richtet sich allein die Festhaltung aus ADR-0017 B6.
 *
 * Sammelt alle Abweisungen statt bei der ersten abzubrechen (ADR-0019 Konsequenzen).
 */
export function pruefeHoheit(
  vorhaben: readonly Feldvorhaben[],
  quellenklasse: Quellenklasse,
  regeln: ReadonlyMap<string, Hoheitsmodus>,
): Abweisung[] {
  if (quellenklasse === "automatic") {
    return [];
  }

  const abweisungen: Abweisung[] = [];

  for (const feld of vorhaben) {
    if (istGleich(feld.neuerWert, feld.aktuellerWert)) {
      continue;
    }

    const modus = regeln.get(feld.field) ?? "manual_allowed";

    if (modus === "manual_locked") {
      abweisungen.push({
        field: feld.field,
        reason: "manual_locked",
        rejectedValue: feld.neuerWert,
        message: `"${feld.field}" wird nicht von Hand gepflegt`,
      });
      continue;
    }

    if (modus === "automatic_wins" && feld.aktuelleQuellenklasse === "automatic") {
      abweisungen.push({
        field: feld.field,
        reason: "automatic_wins",
        rejectedValue: feld.neuerWert,
        message: `"${feld.field}" wird von einem Vorsystem gefuehrt`,
      });
    }
  }

  return abweisungen;
}
