import { describe, expect, it } from "vitest";
import {
  type Feldvorhaben,
  type Hoheitsmodus,
  pruefeHoheit,
  type Quellenklasse,
} from "../src/requirements/hoheitspruefung";

function feld(teil: Partial<Feldvorhaben>): Feldvorhaben {
  return {
    field: "owner",
    neuerWert: "T. Schmidt",
    aktuellerWert: "M. Weber",
    aktuelleQuellenklasse: "automatic",
    ...teil,
  };
}

function regeln(...paare: [string, Hoheitsmodus][]): Map<string, Hoheitsmodus> {
  return new Map(paare);
}

const MANUELL: Quellenklasse = "manual";

describe("Hoheitspruefung", () => {
  it("laesst durch, wenn keine Regel besteht", () => {
    expect(pruefeHoheit([feld({})], MANUELL, regeln())).toEqual([]);
  });

  it("laesst durch bei manual_allowed", () => {
    expect(pruefeHoheit([feld({})], MANUELL, regeln(["owner", "manual_allowed"]))).toEqual([]);
  });

  describe("automatic_wins", () => {
    const regel = regeln(["owner", "automatic_wins"]);

    it("weist die manuelle Aenderung ab, wenn ein Vorsystem den Wert haelt", () => {
      const abweisungen = pruefeHoheit([feld({})], MANUELL, regel);

      expect(abweisungen).toHaveLength(1);
      expect(abweisungen[0]).toMatchObject({ field: "owner", reason: "automatic_wins" });
    });

    it("laesst durch, wenn der aktuelle Wert von Hand gesetzt wurde", () => {
      const vorhaben = feld({ aktuelleQuellenklasse: "manual" });

      expect(pruefeHoheit([vorhaben], MANUELL, regel)).toEqual([]);
    });

    it("laesst durch, wenn das Feld noch keinen Wert traegt", () => {
      const vorhaben = feld({ aktuellerWert: null, aktuelleQuellenklasse: undefined });

      expect(pruefeHoheit([vorhaben], MANUELL, regel)).toEqual([]);
    });

    it("laesst eine automatische Quelle immer durch", () => {
      expect(pruefeHoheit([feld({})], "automatic", regel)).toEqual([]);
    });
  });

  describe("manual_locked", () => {
    const regel = regeln(["owner", "manual_locked"]);

    it("weist die manuelle Aenderung ab, auch ohne Vorsystem", () => {
      const vorhaben = feld({ aktuelleQuellenklasse: "manual" });
      const abweisungen = pruefeHoheit([vorhaben], MANUELL, regel);

      expect(abweisungen).toHaveLength(1);
      expect(abweisungen[0]).toMatchObject({ reason: "manual_locked" });
    });

    it("weist auch die erstmalige Belegung ab", () => {
      const vorhaben = feld({ aktuellerWert: null, aktuelleQuellenklasse: undefined });

      expect(pruefeHoheit([vorhaben], MANUELL, regel)).toHaveLength(1);
    });
  });

  describe("Unveraenderte Werte", () => {
    it("weist nicht ab, wenn der Wert gleich bleibt", () => {
      const vorhaben = feld({ neuerWert: "M. Weber", aktuellerWert: "M. Weber" });

      expect(pruefeHoheit([vorhaben], MANUELL, regeln(["owner", "manual_locked"]))).toEqual([]);
    });

    it("behandelt null und fehlend als gleich", () => {
      const vorhaben = feld({ neuerWert: null, aktuellerWert: undefined });

      expect(pruefeHoheit([vorhaben], MANUELL, regeln(["owner", "manual_locked"]))).toEqual([]);
    });

    it("erkennt eine geaenderte Werteliste als Aenderung", () => {
      const vorhaben = feld({
        field: "tags",
        neuerWert: ["a", "b"],
        aktuellerWert: ["a"],
        aktuelleQuellenklasse: "automatic",
      });

      expect(pruefeHoheit([vorhaben], MANUELL, regeln(["tags", "automatic_wins"]))).toHaveLength(1);
    });
  });

  it("sammelt alle Abweisungen statt bei der ersten abzubrechen", () => {
    const vorhaben = [
      feld({ field: "owner" }),
      feld({ field: "status", neuerWert: "x", aktuellerWert: "neu" }),
    ];

    const abweisungen = pruefeHoheit(
      vorhaben,
      MANUELL,
      regeln(["owner", "automatic_wins"], ["status", "manual_locked"]),
    );

    expect(abweisungen.map((a) => a.field).sort()).toEqual(["owner", "status"]);
  });
});
