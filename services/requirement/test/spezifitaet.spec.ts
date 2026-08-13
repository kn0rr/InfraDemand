import { describe, expect, it } from "vitest";
import { spezifischste, spezifischsteJe } from "../src/gemeinsam/spezifitaet";

const beide = { tenant: "t-eins", requirementType: "bestellung" };
const nurArt = { tenant: null, requirementType: "bestellung" };
const nurMandant = { tenant: "t-eins", requirementType: null };
const keines = { tenant: null, requirementType: null };

describe("spezifischste", () => {
  it("waehlt die vollstaendig passende", () => {
    expect(spezifischste([keines, nurMandant, nurArt, beide])).toBe(beide);
  });

  it("stellt die Anforderungsart ueber den Mandanten", () => {
    // Der Fall aus ADR-0026: Eine allgemeine Regel des Mandanten darf einen
    // plattformweiten Prozess fuer eine bestimmte Art nicht aushebeln.
    expect(spezifischste([nurMandant, nurArt])).toBe(nurArt);
  });

  it("faellt auf die plattformweite Vorgabe zurueck", () => {
    expect(spezifischste([keines])).toBe(keines);
  });

  it("liefert bei leerer Auswahl nichts", () => {
    expect(spezifischste([])).toBeUndefined();
  });

  it("haengt nicht von der Reihenfolge ab", () => {
    // Sonst entschiede die Zeilenreihenfolge der Datenbank.
    expect(spezifischste([beide, keines])).toBe(beide);
    expect(spezifischste([keines, beide])).toBe(beide);
  });

  it("behandelt fehlende Artangabe wie „gilt fuer alle", () => {
    // Hoheitsregeln kennen die Dimension nicht (ADR-0017 A5).
    const mandant = { tenant: "t-eins" };
    const platt = { tenant: null };

    expect(spezifischste([platt, mandant])).toBe(mandant);
  });
});

describe("spezifischsteJe", () => {
  it("liefert je Schluessel genau eine", () => {
    const eintraege = [
      { key: "prio", tenant: null, requirementType: null },
      { key: "prio", tenant: "t-eins", requirementType: null },
      { key: "kostenstelle", tenant: null, requirementType: null },
    ];

    const ergebnis = spezifischsteJe(eintraege, (e) => e.key);

    expect(ergebnis).toHaveLength(2);
    expect(ergebnis.find((e) => e.key === "prio")?.tenant).toBe("t-eins");
  });

  it("wendet nicht beide an", () => {
    // Zwei Definitionen fuer denselben Schluessel sind zwei Antworten auf dieselbe Frage.
    const eintraege = [
      { key: "prio", tenant: null, requirementType: null },
      { key: "prio", tenant: "t-eins", requirementType: null },
    ];

    expect(spezifischsteJe(eintraege, (e) => e.key)).toHaveLength(1);
  });
});
