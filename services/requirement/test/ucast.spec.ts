import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { deuteAntwort, type Sichtbarkeit } from "../src/berechtigung/sichtbarkeit.typen";
import { alsBedingung } from "../src/berechtigung/ucast";

const dialekt = new PgDialect();

/** Uebersetzt bis zur fertigen Abfrage - `JSON.stringify` scheitert am Spaltenverweis. */
const uebersetzt = (rumpf: unknown) => dialekt.sqlToQuery(alsBedingung(deuteAntwort(rumpf)));

describe("deuteAntwort", () => {
  it("deutet einen leeren Rumpf als „nichts", () => {
    expect(deuteAntwort({})).toEqual({ art: "nichts" });
  });

  it("deutet ein leeres query als 'alles'", () => {
    expect(deuteAntwort({ result: { query: {} } })).toEqual({ art: "alles" });
  });

  it("deutet eine Bedingung als solche", () => {
    const rumpf = {
      result: {
        query: { type: "field", field: "requirement.tenant", operator: "in", value: ["t-eins"] },
      },
    };

    expect(deuteAntwort(rumpf).art).toBe("bedingung");
  });

  it("wirft bei einem unverstandenen Rumpf, statt ihn als 'alles' zu lesen", () => {
    expect(() => deuteAntwort({ result: { query: { type: "compound" } } })).toThrow();
    expect(() => deuteAntwort({ result: "ja" })).toThrow();
    expect(() => deuteAntwort("ja")).toThrow();
  });
});

describe("alsBedingung", () => {
  it("filtert auf die genannten Mandanten", () => {
    const rumpf = {
      result: {
        query: {
          type: "field",
          field: "requirement.tenant",
          operator: "in",
          value: ["t-eins", "t-zwei"],
        },
      },
    };

    const abfrage = uebersetzt(rumpf);

    expect(abfrage.params).toEqual(["t-eins", "t-zwei"]);
    expect(abfrage.sql).toContain("tenant");

    // **Die Werte stehen als Parameter, nicht in der Abfrage.** Genau deshalb wird das
    // UCAST-Format ausgewertet und nicht das SQL-Zielformat der Compile-API: Jenes
    // liefert eine fertige Zeichenkette mit eingesetzten Werten, und die Bindung durch
    // Drizzle entfiele - an der Stelle, an der die Werte aus einem Token stammen.
    expect(abfrage.sql).not.toContain("t-eins");
  });

  it("macht aus einer leeren Liste false und nicht kein-Filter", () => {
    const rumpf = {
      result: {
        query: { type: "field", field: "requirement.tenant", operator: "in", value: [] },
      },
    };

    const abfrage = uebersetzt(rumpf);

    expect(abfrage.sql).toBe("false");
    expect(abfrage.params).toEqual([]);
  });

  it("macht aus nichts false und aus alles true", () => {
    const nichts: Sichtbarkeit = { art: "nichts" };
    const alles: Sichtbarkeit = { art: "alles" };

    expect(dialekt.sqlToQuery(alsBedingung(nichts)).sql).toBe("false");
    expect(dialekt.sqlToQuery(alsBedingung(alles)).sql).toBe("true");
  });

  it("wirft bei einem unbekannten Feld", () => {
    const rumpf = {
      result: {
        query: { type: "field", field: "requirement.owner", operator: "in", value: ["x"] },
      },
    };

    expect(() => uebersetzt(rumpf)).toThrow(/unbekanntes Feld/);
  });

  it("wirft bei einem unbekannten Vergleich", () => {
    const rumpf = {
      result: {
        query: { type: "field", field: "requirement.tenant", operator: "gt", value: "t" },
      },
    };

    expect(() => uebersetzt(rumpf)).toThrow(/Unbekannter Vergleich/);
  });
});
