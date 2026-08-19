import { describe, expect, it } from "vitest";
import { genannteFelder, pruefeGraph, unerreichbareZustaende } from "../src/workflows/graph-pruefung";
import type { Bedingung, Graph } from "../src/workflows/typen";

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

  describe("Bedingungen (ADR-0024)", () => {
    const mitBedingung = (bedingung: Bedingung, von = "neu", nach = "in_pruefung") =>
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "in_pruefung", label: "In Pruefung" },
          { key: "erledigt", label: "Erledigt", final: true },
        ],
        transitions: [
          { from: "neu", to: "in_pruefung", label: "Einreichen" },
          { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
        ].map((uebergang) =>
          uebergang.from === von && uebergang.to === nach
            ? { ...uebergang, bedingungen: [bedingung] }
            : uebergang,
        ),
      });

    it("nimmt eine wohlgeformte Bedingung an", () => {
      expect(
        pruefeGraph(mitBedingung({ art: "rolle", eineVon: ["freigeber"] }), "internal"),
      ).toEqual([]);
    });

    it("weist eine Rollenbedingung ohne Rolle ab", () => {
      expect(pruefeGraph(mitBedingung({ art: "rolle", eineVon: [] }), "internal")).toHaveLength(1);
    });

    it("weist einen unbekannten Zustand im Vier-Augen-Bezug ab", () => {
      expect(
        pruefeGraph(
          mitBedingung({ art: "vier_augen", andersAlsBeiEintritt: "erfunden" }),
          "internal",
        ),
      ).toHaveLength(1);
    });

    it("weist einen unbekannten Vergleich ab", () => {
      const befunde = pruefeGraph(
        mitBedingung({
          art: "rolle",
          eineVon: ["freigeber"],
          nurWenn: [{ feld: "betrag", operator: "ungefaehr" as never, wert: 1 }],
        }),
        "internal",
      );

      expect(befunde).toHaveLength(1);
    });

    it("weist einen Operator mit unpassendem Wert ab", () => {
      expect(
        pruefeGraph(
          mitBedingung({
            art: "rolle",
            eineVon: ["freigeber"],
            nurWenn: [{ feld: "kategorie", operator: "istEinesVon", wert: "cloud" }],
          }),
          "internal",
        ),
      ).toHaveLength(1);
    });

    it("weist Bedingungen an einem fremdgefuehrten Workflow ab", () => {
      // Dort entscheidet das Fremdsystem - eine Bedingung wuerde nie ausgewertet und
      // saehe trotzdem aus wie eine Zusicherung.
      const fremd = mitBedingung({ art: "rolle", eineVon: ["freigeber"] });

      expect(pruefeGraph(fremd, "external").length).toBeGreaterThan(0);
    });
  });

  describe("Vier-Augen-Bezug muss auf jedem Weg liegen", () => {
    /**
     * neu -> in_pruefung -> erledigt
     * neu -> eilverfahren -> erledigt
     *
     * Der Uebergang nach `erledigt` aus `eilverfahren` kann sich nicht auf `in_pruefung`
     * berufen - auf diesem Weg hat ihn niemand ausgeloest.
     */
    const zweiWege = (bezug: string) =>
      graph({
        states: [
          { key: "neu", label: "Neu" },
          { key: "in_pruefung", label: "In Pruefung" },
          { key: "eilverfahren", label: "Eilverfahren" },
          { key: "erledigt", label: "Erledigt", final: true },
        ],
        transitions: [
          { from: "neu", to: "in_pruefung", label: "Einreichen" },
          { from: "neu", to: "eilverfahren", label: "Eilig einreichen" },
          { from: "in_pruefung", to: "erledigt", label: "Freigeben" },
          {
            from: "eilverfahren",
            to: "erledigt",
            label: "Eilig freigeben",
            bedingungen: [{ art: "vier_augen", andersAlsBeiEintritt: bezug }],
          },
        ],
      });

    it("weist einen Bezug ab, der nur auf einem Weg liegt", () => {
      const befunde = pruefeGraph(zweiWege("in_pruefung"), "internal");

      expect(befunde).toHaveLength(1);
      expect(befunde[0]?.message).toContain("nicht auf jedem Weg");
    });

    it("nimmt einen Bezug an, der auf jedem Weg liegt", () => {
      // `neu` wird immer durchlaufen - der Bezug trifft damit den Ersteller.
      expect(pruefeGraph(zweiWege("neu"), "internal")).toEqual([]);
    });

    it("nimmt den Ausgangszustand selbst an", () => {
      expect(pruefeGraph(zweiWege("eilverfahren"), "internal")).toEqual([]);
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
  describe("genannteFelder", () => {
  const mitBedingung = (bedingung: Bedingung): Graph =>
    graph({
      transitions: [{ from: "neu", to: "erledigt", label: "Abschliessen", bedingungen: [bedingung] }],
    });

  it("nennt das Feld einer Identitaetsbedingung mit ihrer Art", () => {
    expect(genannteFelder(mitBedingung({ art: "identitaet", feld: "owner" }))).toEqual([
      { feld: "owner", stelle: "transitions[0].bedingungen[0]", art: "identitaet" },
    ]);
  });

  it("nennt jedes Pflichtfeld einzeln", () => {
    const felder = genannteFelder(
      mitBedingung({ art: "pflichtfelder", felder: ["titel", "budget"] }),
    );

    expect(felder.map((eintrag) => eintrag.feld)).toEqual(["titel", "budget"]);
    expect(felder.every((eintrag) => eintrag.art === "pflichtfelder")).toBe(true);
  });

  it("gibt einem Vorbehalt nicht die Art der aeusseren Bedingung", () => {
    // Der Fall, der sonst niemandem auffiele: Als "identitaet" getagt verlangte die
    // Pruefung aus ADR-0031 Punkt 4 von `prioritaet` eine Person - und wiese einen
    // gueltigen Graphen ab. Der Fehler zeigte sich nicht als falsches Verhalten,
    // sondern als grundlose 400 an einer ganz anderen Stelle.
    const felder = genannteFelder(
      mitBedingung({
        art: "identitaet",
        feld: "owner",
                nurWenn: [{ feld: "prioritaet", operator: "istGleich", wert: "hoch" }],
      }),
    );

    expect(felder).toContainEqual({
      feld: "prioritaet",
      stelle: "transitions[0].bedingungen[0].nurWenn",
      art: "vorbehalt",
    });
  });

  it("nennt keine Felder ohne Bedingungen", () => {
    expect(genannteFelder(graph())).toEqual([]);
  });
});
});
