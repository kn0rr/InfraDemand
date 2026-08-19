import { describe, expect, it } from "vitest";
import type { GeltendeDefinition } from "../src/attribute-definitions/attribut-pruefung";
import { pruefeDynamischeAttribute } from "../src/attribute-definitions/attribut-pruefung";

function definition(teil: Partial<GeltendeDefinition>): GeltendeDefinition {
  return {
    key: "feld",
    label: "Feld",
    dataType: "text",
    required: false,
    defaultValue: null,
    allowedValues: null,
    visibleFor: null,
    ...teil,
  };
}

describe("Pruefung dynamischer Attribute", () => {
  it("uebernimmt gueltige Werte", () => {
    const { werte, fehler } = pruefeDynamischeAttribute(
      { titel: "Ein Text", anzahl: 3, aktiv: true },
      [
        definition({ key: "titel", label: "Titel", dataType: "text" }),
        definition({ key: "anzahl", label: "Anzahl", dataType: "number" }),
        definition({ key: "aktiv", label: "Aktiv", dataType: "boolean" }),
      ],
    );

    expect(fehler).toEqual([]);
    expect(werte).toEqual({ titel: "Ein Text", anzahl: 3, aktiv: true });
  });

  it("weist nicht definierte Schluessel ab", () => {
    const { fehler } = pruefeDynamischeAttribute({ unbekannt: "x" }, []);

    expect(fehler).toHaveLength(1);
    expect(fehler[0]?.key).toBe("unbekannt");
  });

  it("sammelt alle Fehler statt beim ersten abzubrechen", () => {
    const { fehler } = pruefeDynamischeAttribute({ a: 1, b: 2 }, [
      definition({ key: "a", label: "A", dataType: "text" }),
      definition({ key: "b", label: "B", dataType: "text" }),
      definition({ key: "c", label: "C", dataType: "text", required: true }),
    ]);

    expect(fehler.map((e) => e.key).sort()).toEqual(["a", "b", "c"]);
  });

  describe("Pflichtfelder", () => {
    it("beanstandet ein fehlendes Pflichtfeld", () => {
      const { fehler } = pruefeDynamischeAttribute({}, [
        definition({ key: "pflicht", label: "Pflicht", required: true }),
      ]);

      expect(fehler).toHaveLength(1);
    });

    it("wertet die leere Zeichenkette als fehlend", () => {
      const { fehler } = pruefeDynamischeAttribute({ pflicht: "" }, [
        definition({ key: "pflicht", label: "Pflicht", required: true }),
      ]);

      expect(fehler).toHaveLength(1);
    });

    it("schreibt leere optionale Attribute nicht", () => {
      const { werte, fehler } = pruefeDynamischeAttribute({ optional: "" }, [
        definition({ key: "optional", label: "Optional" }),
      ]);

      expect(fehler).toEqual([]);
      expect(werte).toEqual({});
    });
  });

  describe("Vorgabewerte", () => {
    it("setzt den Vorgabewert, wenn der Schluessel fehlt", () => {
      const { werte } = pruefeDynamischeAttribute({}, [
        definition({ key: "prio", label: "Prio", defaultValue: "mittel" }),
      ]);

      expect(werte).toEqual({ prio: "mittel" });
    });

    it("laesst einen angegebenen Wert dem Vorgabewert vorgehen", () => {
      const { werte } = pruefeDynamischeAttribute({ prio: "hoch" }, [
        definition({ key: "prio", label: "Prio", defaultValue: "mittel" }),
      ]);

      expect(werte).toEqual({ prio: "hoch" });
    });
  });

  describe("Datum", () => {
    it("nimmt ein gueltiges Datum an", () => {
      const { fehler } = pruefeDynamischeAttribute({ tag: "2026-02-28" }, [
        definition({ key: "tag", label: "Tag", dataType: "date" }),
      ]);

      expect(fehler).toEqual([]);
    });

    it("weist den 31. Februar ab, den JavaScript stillschweigend verschieben wuerde", () => {
      const { fehler } = pruefeDynamischeAttribute({ tag: "2026-02-31" }, [
        definition({ key: "tag", label: "Tag", dataType: "date" }),
      ]);

      expect(fehler).toHaveLength(1);
    });

    it("weist den 29. Februar in einem Nicht-Schaltjahr ab", () => {
      const { fehler } = pruefeDynamischeAttribute({ tag: "2026-02-29" }, [
        definition({ key: "tag", label: "Tag", dataType: "date" }),
      ]);

      expect(fehler).toHaveLength(1);
    });

    it("weist einen Zeitstempel ab", () => {
      const { fehler } = pruefeDynamischeAttribute({ tag: "2026-02-28T10:00:00Z" }, [
        definition({ key: "tag", label: "Tag", dataType: "date" }),
      ]);

      expect(fehler).toHaveLength(1);
    });
  });

  describe("Aufzaehlungen", () => {
    const farbe = definition({
      key: "farbe",
      label: "Farbe",
      dataType: "enum",
      allowedValues: ["rot", "gruen"],
    });

    it("nimmt einen zulaessigen Wert an", () => {
      expect(pruefeDynamischeAttribute({ farbe: "rot" }, [farbe]).fehler).toEqual([]);
    });

    it("weist einen unzulaessigen Wert ab", () => {
      expect(pruefeDynamischeAttribute({ farbe: "blau" }, [farbe]).fehler).toHaveLength(1);
    });

    const tags = definition({
      key: "tags",
      label: "Tags",
      dataType: "multi_enum",
      allowedValues: ["a", "b", "c"],
    });

    it("nimmt eine Teilmenge an", () => {
      expect(pruefeDynamischeAttribute({ tags: ["a", "c"] }, [tags]).fehler).toEqual([]);
    });

    it("weist Wiederholungen ab", () => {
      expect(pruefeDynamischeAttribute({ tags: ["a", "a"] }, [tags]).fehler).toHaveLength(1);
    });

    it("weist einen Einzelwert statt einer Liste ab", () => {
      expect(pruefeDynamischeAttribute({ tags: "a" }, [tags]).fehler).toHaveLength(1);
    });
  });

  describe("Typabweichungen", () => {
    it("weist Text ab, wo eine Zahl erwartet wird", () => {
      const { fehler } = pruefeDynamischeAttribute({ n: "3" }, [
        definition({ key: "n", label: "N", dataType: "number" }),
      ]);

      expect(fehler).toHaveLength(1);
    });

    it("weist NaN und Unendlich ab", () => {
      const definitionen = [definition({ key: "n", label: "N", dataType: "number" })];

      expect(pruefeDynamischeAttribute({ n: Number.NaN }, definitionen).fehler).toHaveLength(1);
      expect(
        pruefeDynamischeAttribute({ n: Number.POSITIVE_INFINITY }, definitionen).fehler,
      ).toHaveLength(1);
    });
  });
});
