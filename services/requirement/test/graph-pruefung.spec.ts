import { describe, expect, it } from "vitest";
import { pruefeGraph, unerreichbareZustaende } from "../src/workflows/graph-pruefung";
import type { Graph } from "../src/workflows/typen";

function graph(teil: Partial<Graph> = {}): Graph {
  return {
    initialState: "neu",
    states: [
      { key: "neu", label: "Neu" },
      { key: "erledigt", label: "Erledigt", final: true },
    ],
    transitions: [{ from: "neu", to: "erledigt", label: "Abschliessen" }],
    ...teil,
  };
}

describe("pruefeGraph", () => {
  it("beanstandet einen vollstaendigen Graphen nicht", () => {
    expect(pruefeGraph(graph(), "internal")).toEqual([]);
  });

  it("verlangt mindestens einen Zustand", () => {
    const befunde = pruefeGraph(graph({ states: [], transitions: [] }), "internal");

    expect(befunde).toHaveLength(2);
    expect(befunde).toContainEqual({
      stelle: "states",
      message: "Ein Workflow braucht mindestens einen Zustand",
    });
  });

  it("erkennt doppelte Zustandsschluessel", () => {
    const befunde = pruefeGraph(
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "neu", label: "Neu, aber anders" },
          { key: "erledigt", label: "Erledigt", final: true },
        ],
      }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("states[1]");
  });

  it("erkennt einen Anfangszustand, den es nicht gibt", () => {
    const befunde = pruefeGraph(graph({ initialState: "erfunden" }), "internal");

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("initialState");
  });

  it("erkennt einen Uebergang auf einen unbekannten Zustand", () => {
    const befunde = pruefeGraph(
      graph({ transitions: [{ from: "neu", to: "erfunden", label: "X" }] }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("transitions[0].to");
  });

  it("erkennt einen Uebergang auf sich selbst", () => {
    const befunde = pruefeGraph(
      graph({
        transitions: [
          { from: "neu", to: "erledigt", label: "Abschliessen" },
          { from: "neu", to: "neu", label: "Nichts" },
        ],
      }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("transitions[1]");
  });

  it("erkennt zwei Uebergaenge zwischen denselben Zustaenden", () => {
    const befunde = pruefeGraph(
      graph({
        transitions: [
          { from: "neu", to: "erledigt", label: "Abschliessen" },
          { from: "neu", to: "erledigt", label: "Doch abschliessen" },
        ],
      }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("transitions[1]");
  });

  it("erkennt einen Endzustand mit ausgehendem Uebergang", () => {
    const befunde = pruefeGraph(
      graph({
        transitions: [
          { from: "neu", to: "erledigt", label: "Abschliessen" },
          { from: "erledigt", to: "neu", label: "Wieder oeffnen" },
        ],
      }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("states[1]");
  });

  it("erkennt eine Sackgasse ohne Endzustandskennzeichnung", () => {
    const befunde = pruefeGraph(
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "erledigt", label: "Erledigt" },
        ],
      }),
      "internal",
    );

    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.stelle).toBe("states[1]");
  });

  it("haelt einen einzelnen Zustand ohne Uebergaenge nicht fuer eine Sackgasse", () => {
    // Ein Workflow im Aufbau hat einen Zustand und noch keinen Uebergang. Waere das ein
    // Fehler, koennte man ihn nicht anlegen, ohne ihn in einem Zug fertigzustellen.
    const befunde = pruefeGraph(
      graph({ states: [{ key: "neu", label: "Neu" }], transitions: [] }),
      "internal",
    );

    expect(befunde).toEqual([]);
  });

  it("sammelt mehrere Befunde, statt beim ersten abzubrechen", () => {
    const befunde = pruefeGraph(
      graph({
        initialState: "erfunden",
        transitions: [{ from: "neu", to: "auch-erfunden", label: "X" }],
      }),
      "internal",
    );

    expect(befunde.length).toBeGreaterThan(1);
  });

  describe("Betriebsart", () => {
    it("laesst bei external Zustaende ohne Uebergaenge zu", () => {
      const fremd = graph({
        initialState: "offen",
        states: [
          { key: "offen", label: "Offen" },
          { key: "in_pruefung", label: "In Pruefung" },
          { key: "erledigt", label: "Erledigt" },
        ],
        transitions: [],
      });

      // Jira entscheidet die Uebergaenge - unser Graph fuehrt nur die Zustaende auf.
      expect(pruefeGraph(fremd, "external")).toEqual([]);
      // Derselbe Graph waere eigengefuehrt dreimal eine Sackgasse.
      expect(pruefeGraph(fremd, "internal")).toHaveLength(3);
    });

    it("weist strukturelle Widersprueche auch bei external ab", () => {
      const fremd = graph({
        initialState: "erfunden",
        transitions: [{ from: "neu", to: "auch-erfunden", label: "X" }],
      });

      expect(pruefeGraph(fremd, "external")).toHaveLength(2);
    });
  });
});

describe("unerreichbareZustaende", () => {
  it("meldet nichts, wenn jeder Zustand erreichbar ist", () => {
    expect(unerreichbareZustaende(graph())).toEqual([]);
  });

  it("findet einen Zustand ohne eingehenden Uebergang", () => {
    const befunde = unerreichbareZustaende(
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "erledigt", label: "Erledigt", final: true },
          { key: "verworfen", label: "Verworfen", final: true },
        ],
      }),
    );

    expect(befunde).toEqual(["verworfen"]);
  });

  it("laeuft bei einem Kreis nicht endlos", () => {
    const befunde = unerreichbareZustaende(
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "pruefung", label: "In Pruefung" },
          { key: "erledigt", label: "Erledigt", final: true },
          { key: "verworfen", label: "Verworfen", final: true },
        ],
        transitions: [
          { from: "neu", to: "pruefung", label: "Einreichen" },
          { from: "pruefung", to: "neu", label: "Zurueckgeben" },
          { from: "pruefung", to: "erledigt", label: "Freigeben" },
        ],
      }),
    );

    expect(befunde).toEqual(["verworfen"]);
  });
});
