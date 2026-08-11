import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/uebergaenge", async (original) => ({
  ...(await original<typeof import("@/lib/api/uebergaenge")>()),
  useUebergaenge: vi.fn(),
  useZustandswechsel: vi.fn(),
}));

import { Zustandswechsel } from "@/app/anforderungen/zustandswechsel";
import type { Uebergangsauskunft } from "@/lib/api/uebergaenge";
import { useUebergaenge, useZustandswechsel } from "@/lib/api/uebergaenge";

/**
 * Die Hooks sind ersetzt, nicht der Netzwerkzugriff.
 *
 * Geprueft wird, **was die Komponente aus der Antwort macht** - nicht, ob sie die richtige
 * Adresse aufruft. Dafuer gibt es die Integrationstests des Dienstes. Ein Test, der beides
 * vermengt, wird bei jeder Aenderung an einem der beiden rot.
 */
const wechseln = vi.fn();

function auskunft(teil: Partial<Uebergangsauskunft> = {}): Uebergangsauskunft {
  return {
    currentState: "neu",
    currentStateInWorkflow: true,
    transitions: [],
    ...teil,
  };
}

function zeige(daten: Uebergangsauskunft) {
  vi.mocked(useUebergaenge).mockReturnValue({
    data: daten,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUebergaenge>);

  render(
    <MantineProvider>
      <Zustandswechsel anforderungId="a-1" />
    </MantineProvider>,
  );
}

beforeEach(() => {
  wechseln.mockReset();

  vi.mocked(useZustandswechsel).mockReturnValue({
    mutate: wechseln,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useZustandswechsel>);
});

describe("Gesperrte Uebergaenge", () => {
  it("zeigt sie an, statt sie wegzulassen - mit dem Grund im Text", async () => {
    zeige(
      auskunft({
        transitions: [
          {
            toState: "in_pruefung",
            label: "Einreichen",
            allowed: false,
            requiresReason: false,
            blockedBy: [
              { kind: "rolle", message: "Dieser Uebergang verlangt eine dieser Rollen: freigeber" },
            ],
          },
        ],
      }),
    );

    // Wer keine Schaltflaeche saehe, wuesste nicht, ob der Vorgang zu Ende ist oder ihm
    // eine Rolle fehlt.
    expect(screen.getByRole("button", { name: "Einreichen" })).toBeDisabled();

    // Als Text, nicht im Tooltip: sonst erreicht der Grund weder Touch noch Screenreader.
    expect(screen.getByText(/verlangt eine dieser Rollen/)).toBeVisible();
  });

  it("fuehrt mehrere Gruende einzeln auf", () => {
    zeige(
      auskunft({
        transitions: [
          {
            toState: "in_pruefung",
            label: "Einreichen",
            allowed: false,
            requiresReason: false,
            blockedBy: [
              { kind: "rolle", message: "Rolle fehlt" },
              { kind: "pflichtfelder", message: "Diese Felder muessen gefuellt sein: begruendung" },
            ],
          },
        ],
      }),
    );

    expect(screen.getByText("Rolle fehlt")).toBeVisible();
    expect(screen.getByText(/Diese Felder muessen gefuellt sein/)).toBeVisible();
  });
});

describe("Leere Liste bedeutet zweierlei", () => {
  it("abgeschlossen, wenn der Zustand im Workflow vorkommt", () => {
    zeige(auskunft({ currentState: "erledigt", transitions: [] }));

    expect(screen.getByText(/Vorgang ist abgeschlossen/)).toBeVisible();
    expect(screen.queryByText(/haengt/)).toBeNull();
  });

  it("haengengeblieben, wenn er es nicht tut", () => {
    zeige(
      auskunft({ currentState: "freigegeben", currentStateInWorkflow: false, transitions: [] }),
    );

    // Ohne diese Unterscheidung saehen beide Faelle gleich aus - eine leere Liste.
    expect(screen.getByText(/haengt/)).toBeVisible();
    expect(screen.getByText(/freigegeben/)).toBeVisible();
    expect(screen.queryByText(/kein Uebergang weiter/)).toBeNull();
  });
});

describe("Begruendungspflicht", () => {
  const mitBegruendung = auskunft({
    transitions: [
      {
        toState: "in_pruefung",
        label: "Einreichen",
        allowed: true,
        requiresReason: true,
        blockedBy: [],
      },
    ],
  });

  it("sperrt den Uebergang nicht, sondern fragt nach", async () => {
    const anwender = userEvent.setup();
    zeige(mitBegruendung);

    // Eine fehlende Begruendung ist kein Hinderungsgrund - sie entsteht erst beim
    // Ausloesen. Waere der Knopf gesperrt, muesste die Oberflaeche `allowed` ignorieren.
    const knopf = screen.getByRole("button", { name: "Einreichen" });
    expect(knopf).toBeEnabled();

    await anwender.click(knopf);

    // Vorhanden genuegt. Ob der Einblendeuebergang schon durch ist, sagt nichts ueber das
    // Verhalten aus - nur ueber den Augenblick der Messung. `toBeVisible` waere hier ein
    // Test, der gelegentlich rot wird, ohne dass etwas kaputt ist.
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(wechseln).not.toHaveBeenCalled();
  });

  it("gibt die Begruendung mit dem Wechsel mit", async () => {
    const anwender = userEvent.setup();
    zeige(mitBegruendung);

    await anwender.click(screen.getByRole("button", { name: "Einreichen" }));
    await anwender.type(await screen.findByRole("textbox"), "Fachlich abgestimmt");
    await anwender.click(screen.getByRole("button", { name: "Uebergang ausloesen" }));

    expect(wechseln).toHaveBeenCalledWith(
      { id: "a-1", toState: "in_pruefung", reason: "Fachlich abgestimmt" },
      expect.anything(),
    );
  });
});

describe("Zulaessiger Uebergang ohne Begruendung", () => {
  it("loest unmittelbar aus", async () => {
    const anwender = userEvent.setup();
    zeige(
      auskunft({
        transitions: [
          {
            toState: "in_pruefung",
            label: "Einreichen",
            allowed: true,
            requiresReason: false,
            blockedBy: [],
          },
        ],
      }),
    );

    await anwender.click(screen.getByRole("button", { name: "Einreichen" }));

    expect(wechseln).toHaveBeenCalledWith(
      { id: "a-1", toState: "in_pruefung", reason: undefined },
      expect.anything(),
    );
  });
});
