import { describe, expect, it } from "vitest";
import {
  pruefeUebergangsbedingungen,
  type Vorgangskontext,
} from "../src/workflows/bedingungspruefung";
import type { Bedingung } from "../src/workflows/typen";

function kontext(teil: Partial<Vorgangskontext> = {}): Vorgangskontext {
  return {
    feldwerte: {
      owner: "benutzer-1",
      kostenschaetzung: 10000,
      kategorie: "legacy",
      standardkonform: true,
      abweichungsbegruendung: "",
    },
    ausloeser: { userId: "benutzer-1", roles: ["requirement-author"] },
    eintritte: new Map([
      ["neu", "benutzer-1"],
      ["in_pruefung", "benutzer-2"],
    ]),
    ...teil,
  };
}

const pruefe = (bedingungen: Bedingung[], teil: Partial<Vorgangskontext> = {}) =>
  pruefeUebergangsbedingungen(bedingungen, kontext(teil));

describe("rolle", () => {
  it("laesst durch, wenn eine der Rollen vorhanden ist", () => {
    expect(pruefe([{ art: "rolle", eineVon: ["freigeber", "requirement-author"] }])).toEqual([]);
  });

  it("weist ab, wenn keine passt", () => {
    const verstoesse = pruefe([{ art: "rolle", eineVon: ["freigeber"] }]);

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("freigeber");
  });
});

describe("vier_augen", () => {
  it("laesst durch, wenn eine andere Person den Zustand ausgeloest hat", () => {
    expect(pruefe([{ art: "vier_augen", andersAlsBeiEintritt: "in_pruefung" }])).toEqual([]);
  });

  it("weist dieselbe Person ab", () => {
    const verstoesse = pruefe([{ art: "vier_augen", andersAlsBeiEintritt: "neu" }]);

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("andere Person");
  });

  it("weist ab, wenn der Zustand nie durchlaufen wurde", () => {
    // Lieber haengenbleiben als ein Kontrollprinzip, das auf einem Pfad still ausfaellt.
    const verstoesse = pruefe([{ art: "vier_augen", andersAlsBeiEintritt: "geprueft" }]);

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("nie durchlaufen");
  });
});

describe("identitaet", () => {
  it("laesst die genannte Person durch", () => {
    expect(pruefe([{ art: "identitaet", feld: "owner" }])).toEqual([]);
  });

  it("weist eine andere ab", () => {
    const verstoesse = pruefe([{ art: "identitaet", feld: "owner" }], {
      ausloeser: { userId: "benutzer-9", roles: [] },
    });

    expect(verstoesse).toHaveLength(1);
  });
});

describe("pflichtfelder", () => {
  it("laesst durch, wenn alle gefuellt sind", () => {
    expect(pruefe([{ art: "pflichtfelder", felder: ["owner", "kategorie"] }])).toEqual([]);
  });

  it("nennt nur die fehlenden", () => {
    const verstoesse = pruefe([
      { art: "pflichtfelder", felder: ["owner", "abweichungsbegruendung"] },
    ]);

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("abweichungsbegruendung");
    expect(verstoesse[0]?.message).not.toContain("owner");
  });

  it("haelt leere Zeichenketten und leere Listen fuer ungefuellt", () => {
    expect(
      pruefe([{ art: "pflichtfelder", felder: ["leer"] }], {
        feldwerte: { leer: [] },
      }),
    ).toHaveLength(1);
  });
});

describe("feldwert", () => {
  it("laesst einen erfuellten Vergleich durch", () => {
    expect(
      pruefe([{ art: "feldwert", feld: "standardkonform", operator: "istGleich", wert: true }]),
    ).toEqual([]);
  });

  it("weist einen unerfuellten ab", () => {
    expect(
      pruefe([{ art: "feldwert", feld: "standardkonform", operator: "istGleich", wert: false }]),
    ).toHaveLength(1);
  });

  it("weist ab, wenn der Vergleich nicht auswertbar ist", () => {
    // Zeichenkette gegen Zahl - raten waere schlimmer als abweisen (ADR-0024 Punkt 7).
    const verstoesse = pruefe(
      [{ art: "feldwert", feld: "kostenschaetzung", operator: "mindestens", wert: 100 }],
      { feldwerte: { kostenschaetzung: "viel" } },
    );

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("nicht auswerten");
  });
});

describe("begruendung", () => {
  it("laesst eine vorhandene durch", () => {
    expect(pruefe([{ art: "begruendung" }], { begruendung: "Weil" })).toEqual([]);
  });

  it("weist eine fehlende ab", () => {
    expect(pruefe([{ art: "begruendung" }])).toHaveLength(1);
  });

  it("weist eine zu kurze ab", () => {
    const verstoesse = pruefe([{ art: "begruendung", mindestlaenge: 20 }], {
      begruendung: "zu kurz",
    });

    expect(verstoesse[0]?.message).toContain("20");
  });
});

describe("nurWenn", () => {
  const teuer: Bedingung = {
    art: "rolle",
    eineVon: ["budget-freigeber"],
    nurWenn: [{ feld: "kostenschaetzung", operator: "mindestens", wert: 50000 }],
  };

  it("prueft nicht, wenn der Vorbehalt nicht greift", () => {
    expect(pruefe([teuer])).toEqual([]);
  });

  it("prueft, wenn er greift", () => {
    expect(pruefe([teuer], { feldwerte: { kostenschaetzung: 80000 } })).toHaveLength(1);
  });

  it("weist ab, wenn der Vorbehalt nicht auswertbar ist", () => {
    // Weder anwenden noch ueberspringen: Beides waere geraten.
    const verstoesse = pruefe([teuer], { feldwerte: { kostenschaetzung: null } });

    expect(verstoesse).toHaveLength(1);
    expect(verstoesse[0]?.message).toContain("Vorbehalt");
  });

  it("verknuepft mehrere Vergleiche mit UND", () => {
    const nurAusserhalbCloud: Bedingung = {
      art: "rolle",
      eineVon: ["architektur-freigeber"],
      nurWenn: [
        { feld: "kostenschaetzung", operator: "mindestens", wert: 5000 },
        { feld: "kategorie", operator: "istUngleich", wert: "cloud" },
      ],
    };

    expect(pruefe([nurAusserhalbCloud])).toHaveLength(1);
    expect(
      pruefe([nurAusserhalbCloud], {
        feldwerte: { kostenschaetzung: 10000, kategorie: "cloud" },
      }),
    ).toEqual([]);
  });
});

describe("Zusammenspiel", () => {
  it("sammelt mehrere Verstoesse", () => {
    expect(
      pruefe([
        { art: "rolle", eineVon: ["freigeber"] },
        { art: "begruendung" },
        { art: "pflichtfelder", felder: ["abweichungsbegruendung"] },
      ]),
    ).toHaveLength(3);
  });

  it("bildet ein ODER durch zwei Regeln mit derselben Anforderung", () => {
    // "Ab 50.000 oder bei Abweichung braucht es die Architekturfreigabe."
    const regeln: Bedingung[] = [
      {
        art: "rolle",
        eineVon: ["architektur-freigeber"],
        nurWenn: [{ feld: "kostenschaetzung", operator: "mindestens", wert: 50000 }],
      },
      {
        art: "rolle",
        eineVon: ["architektur-freigeber"],
        nurWenn: [{ feld: "standardkonform", operator: "istGleich", wert: false }],
      },
    ];

    // Keiner der beiden Ausloeser greift.
    expect(pruefe(regeln)).toEqual([]);

    // Der zweite greift allein - das ODER entsteht aus den zwei Regeln.
    expect(
      pruefe(regeln, { feldwerte: { kostenschaetzung: 1000, standardkonform: false } }),
    ).toHaveLength(1);
  });
});
