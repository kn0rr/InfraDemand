import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  deuteAntwort,
  deuteFeldsicht,
  type Sichtbarkeit,
} from "../src/berechtigung/sichtbarkeit.typen";

import {
  alsBedingung,
  FELDER_BESTAND,
  FELDER_HISTORIE,
  type Feldabbildung,
} from "../src/berechtigung/ucast";

const dialekt = new PgDialect();

/** Uebersetzt bis zur fertigen Abfrage - `JSON.stringify` scheitert am Spaltenverweis. */
const uebersetzt = (rumpf: unknown, felder: Feldabbildung = FELDER_BESTAND) =>
  dialekt.sqlToQuery(alsBedingung(deuteAntwort(rumpf), felder));

const feld = (field: string, operator: string, value: unknown) => ({
  type: "field",
  field,
  operator,
  value,
});
const verbund = (operator: string, ...value: unknown[]) => ({ type: "compound", operator, value });
const rumpf = (query: unknown) => ({ result: { query } });

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
describe("deuteFeldsicht", () => {
  it("deutet eine leere Menge als nichts verborgen", () => {
    expect(deuteFeldsicht({ result: [] }).size).toBe(0);
  });

  it("deutet die Schluessel", () => {
    expect([...deuteFeldsicht({ result: ["kosten"] })]).toEqual(["kosten"]);
  });

  it("wirft bei fehlendem result, statt nichts zu verbergen", () => {
    // `{}` heisst „etwas ging schief". Es als „nichts verborgen" zu lesen waere die
    // gefaehrlichste Auslegung - dieselbe Falle wie bei der Sichtbarkeit.
    expect(() => deuteFeldsicht({})).toThrow();
    expect(() => deuteFeldsicht({ result: "kosten" })).toThrow();
    expect(() => deuteFeldsicht({ result: [42] })).toThrow();
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

    expect(dialekt.sqlToQuery(alsBedingung(nichts, FELDER_BESTAND)).sql).toBe("false");
    expect(dialekt.sqlToQuery(alsBedingung(alles, FELDER_BESTAND)).sql).toBe("true");
  });

  it("wirft bei einem unbekannten Feld", () => {
    // `status` ist eine echte Spalte, steht aber nicht in der Abbildung. Genau darum
    // geht es: Zugelassen ist, was ausgeschrieben ist - nicht, was es im Schema gibt.
    const rumpf = {
      result: {
        query: { type: "field", field: "requirement.status", operator: "eq", value: "neu" },
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
