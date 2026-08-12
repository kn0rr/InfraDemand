import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Bedingungseditor, deuteWert, wechsleArt, zeigeWert } from "@/app/verwaltung/bedingungen";
import type { components } from "@/lib/api/schema";

type Bedingung = components["schemas"]["WorkflowBedingungDto"];

describe("deuteWert", () => {
  it("macht aus true und false Wahrheitswerte", () => {
    expect(deuteWert("true", "istGleich")).toBe(true);
    expect(deuteWert("false", "istGleich")).toBe(false);
  });

  it("macht aus Ziffern Zahlen", () => {
    expect(deuteWert("50000", "mindestens")).toBe(50000);
  });

  it("laesst ein Datum eine Zeichenkette bleiben", () => {
    // ISO-Datumsangaben sortieren lexikografisch richtig - eine Umwandlung in eine Zahl
    // waere hier NaN und die Bedingung nie auswertbar.
    expect(deuteWert("2027-03-01", "mindestens")).toBe("2027-03-01");
  });

  it("zerlegt eine Kommafolge fuer istEinesVon", () => {
    expect(deuteWert("cloud, legacy ,", "istEinesVon")).toEqual(["cloud", "legacy"]);
  });

  it("liefert fuer istGefuellt immer einen Wahrheitswert", () => {
    expect(deuteWert("true", "istGefuellt")).toBe(true);
    expect(deuteWert("irgendwas", "istGefuellt")).toBe(false);
  });

  it("laesst gewoehnlichen Text unangetastet", () => {
    expect(deuteWert("freigeber", "istGleich")).toBe("freigeber");
  });

  it("macht aus Leere keine Zahl", () => {
    // `Number("")` ist 0 - das waere eine Schwelle, die niemand gesetzt hat.
    expect(deuteWert("", "mindestens")).toBe("");
  });
});

describe("wechsleArt", () => {
  const vorbehalt = [{ feld: "kategorie", operator: "istUngleich" as const, wert: "cloud" }];

  it("verwirft die Felder der alten Art", () => {
    expect(
      wechsleArt({ art: "rolle", eineVon: ["freigeber"], nurWenn: vorbehalt }, "pflichtfelder"),
    ).toEqual({ art: "pflichtfelder", nurWenn: vorbehalt });
  });

  it("haelt den Vorbehalt, weil er von der Art unabhaengig ist", () => {
    expect(
      wechsleArt({ art: "feldwert", feld: "betrag", nurWenn: vorbehalt }, "begruendung"),
    ).toMatchObject({ nurWenn: vorbehalt });
  });

  it("erfindet keinen Vorbehalt, wo keiner war", () => {
    expect(wechsleArt({ art: "rolle", eineVon: ["x"] }, "begruendung").nurWenn).toBeUndefined();
  });
});

describe("zeigeWert", () => {
  it("stellt eine Liste als Kommafolge dar", () => {
    expect(zeigeWert(["cloud", "legacy"])).toBe("cloud, legacy");
  });

  it("stellt Leeres als leere Zeichenkette dar", () => {
    expect(zeigeWert(null)).toBe("");
    expect(zeigeWert(undefined)).toBe("");
  });

  it("ist die Umkehrung von deuteWert", () => {
    expect(zeigeWert(deuteWert("cloud, legacy", "istEinesVon"))).toBe("cloud, legacy");
    expect(zeigeWert(deuteWert("50000", "mindestens"))).toBe("50000");
  });
});

describe("Bedingungseditor", () => {
  const aendern = vi.fn();

  function zeige(bedingungen: Bedingung[]) {
    aendern.mockReset();

    render(
      <MantineProvider>
        <Bedingungseditor
          geoeffnet
          schliessen={() => {}}
          uebergang="Freigeben"
          bedingungen={bedingungen}
          aendern={aendern}
          zustaende={[
            { key: "neu", label: "Neu" },
            { key: "in_pruefung", label: "In Pruefung" },
          ]}
          feldnamen={["owner", "kostenschaetzung"]}
        />
      </MantineProvider>,
    );
  }

  it("meldet eine neue Bedingung nach oben", async () => {
    const anwender = userEvent.setup();
    zeige([]);

    await anwender.click(screen.getByRole("button", { name: "Bedingung hinzufuegen" }));

    expect(aendern).toHaveBeenCalledWith([{ art: "rolle", eineVon: [] }]);
  });

  it("zeigt eine Liste als Kommafolge im Eingabefeld", () => {
    zeige([
      { art: "feldwert", feld: "kategorie", operator: "istEinesVon", wert: ["cloud", "legacy"] },
    ]);

    expect(screen.getByLabelText("Wert")).toHaveValue("cloud, legacy");
  });

  it("sagt, dass es keine Bedingungen gibt", () => {
    zeige([]);

    // Eine leere Liste ohne Satz saehe aus wie ein Ladefehler.
    expect(screen.getByText(/Keine Bedingungen/)).toBeInTheDocument();
  });
});
