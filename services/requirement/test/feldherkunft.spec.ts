import { describe, expect, it } from "vitest";
import { type Feldstand, letzteQuelleFuerFeld } from "../src/requirements/feldherkunft";

function stand(changeSource: string, werte: Record<string, unknown>): Feldstand {
  return { changeSource, werte };
}

describe("Feldherkunft", () => {
  it("nennt die Quelle der Anlage, wenn nie geaendert wurde", () => {
    const versionen = [stand("sap", { owner: "M. Weber" })];

    expect(letzteQuelleFuerFeld(versionen, "owner")).toBe("sap");
  });

  it("nennt die Quelle der letzten Aenderung dieses Feldes", () => {
    const versionen = [
      stand("sap", { owner: "M. Weber", status: "neu" }),
      stand("frontend", { owner: "T. Schmidt", status: "neu" }),
    ];

    expect(letzteQuelleFuerFeld(versionen, "owner")).toBe("frontend");
  });

  it("bleibt bei der urspruenglichen Quelle, wenn ein anderes Feld geaendert wurde", () => {
    const versionen = [
      stand("sap", { owner: "M. Weber", status: "neu" }),
      stand("frontend", { owner: "M. Weber", status: "in_arbeit" }),
    ];

    // Das Frontend hat owner nicht angefasst - SAP haelt den Wert weiterhin.
    expect(letzteQuelleFuerFeld(versionen, "owner")).toBe("sap");
  });

  it("nennt die Quelle, die einen Wert zurueckgeschrieben hat", () => {
    const versionen = [
      stand("sap", { owner: "M. Weber" }),
      stand("frontend", { owner: "T. Schmidt" }),
      stand("sap", { owner: "M. Weber" }),
    ];

    expect(letzteQuelleFuerFeld(versionen, "owner")).toBe("sap");
  });

  it("liefert nichts fuer ein Feld, das es nie gab", () => {
    const versionen = [stand("sap", { owner: "M. Weber" })];

    expect(letzteQuelleFuerFeld(versionen, "kostenstelle")).toBeUndefined();
  });

  it("liefert nichts fuer ein Feld, das zuletzt geleert wurde", () => {
    const versionen = [stand("sap", { kostenstelle: "K-1" }), stand("frontend", {})];

    expect(letzteQuelleFuerFeld(versionen, "kostenstelle")).toBeUndefined();
  });

  it("behandelt ein spaeter hinzugekommenes Feld richtig", () => {
    const versionen = [
      stand("sap", { owner: "M. Weber" }),
      stand("frontend", { owner: "M. Weber", kostenstelle: "K-1" }),
    ];

    expect(letzteQuelleFuerFeld(versionen, "kostenstelle")).toBe("frontend");
    expect(letzteQuelleFuerFeld(versionen, "owner")).toBe("sap");
  });

  it("erkennt eine geaenderte Werteliste als Aenderung", () => {
    const versionen = [
      stand("sap", { tags: ["a", "b"] }),
      stand("frontend", { tags: ["a", "b", "c"] }),
    ];

    expect(letzteQuelleFuerFeld(versionen, "tags")).toBe("frontend");
  });
});
