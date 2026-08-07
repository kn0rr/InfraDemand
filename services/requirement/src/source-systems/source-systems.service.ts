import { Injectable } from "@nestjs/common";
import type { SourceSystemRow } from "../database/schema";
import { UnknownSourceSystemError } from "./source-systems.errors";
import { SourceSystemsRepository } from "./source-systems.repository";

export type SourceSystemKind = SourceSystemRow["kind"];

@Injectable()
export class SourceSystemsService {
  constructor(private readonly repository: SourceSystemsRepository) {}

  /**
   * Bestimmt die Quellenklasse einer Schreiboperation (ADR-0017 A4) und weist zurueck,
   * was nicht schreiben darf.
   *
   * **Bewusst ohne Zwischenspeicher.** Es ist eine Abfrage ueber den Primaerschluessel je
   * Schreibvorgang. Ein Zwischenspeicher veraltete, sobald die Registratur ueber die
   * Administrationsoberflaeche gepflegt wird (M3.6) - und eine veraltete Klasse
   * entscheidet Schreibvorgaenge falsch, ohne dass es auffaellt.
   */
  async pruefeSchreibquelle(key: string): Promise<SourceSystemKind> {
    const zeile = await this.repository.findByKey(key);

    if (zeile === undefined) {
      throw new UnknownSourceSystemError(key, "unbekannt");
    }

    if (!zeile.active) {
      // Ausser Betrieb genommene Quellen bleiben aufloesbar - bestehende Datensaetze und
      // ihre Historie verweisen auf sie -, duerfen aber nicht mehr schreiben.
      throw new UnknownSourceSystemError(key, "ausser Betrieb");
    }

    return zeile.kind;
  }
}
