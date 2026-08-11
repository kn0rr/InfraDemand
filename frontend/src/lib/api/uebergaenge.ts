"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { anforderungenSchluessel } from "./anforderungen";
import { requirementClient } from "./client";
import type { components } from "./schema";

export type Uebergangsauskunft = components["schemas"]["UebergangsauskunftResponse"];
export type Uebergangsoption = components["schemas"]["UebergangsoptionResponse"];
export type Bedingungsverstoss = components["schemas"]["BedingungsverstossResponse"];
export type Workflowzustand = components["schemas"]["WorkflowZustandResponse"];

/**
 * Der Service weist einen Uebergang mit den einzelnen Gruenden ab (ADR-0024). Sie werden
 * durchgereicht, damit die Oberflaeche alle nennen kann statt eines nach dem anderen -
 * dieselbe Ueberlegung wie bei `AttributFehler`.
 */
export class BedingungsFehler extends Error {
  constructor(readonly bedingungen: Bedingungsverstoss[]) {
    super("Die Bedingungen dieses Uebergangs sind nicht erfuellt");
    this.name = "BedingungsFehler";
  }
}

export const uebergaengeSchluessel = (id: string) => ["uebergaenge", id] as const;

const api = requirementClient();

/**
 * Welche Uebergaenge diese Anforderung nehmen kann - und warum die anderen nicht.
 *
 * **Ueber die interne Kennung, nicht ueber die Herkunft.** Eigene Erfassung hat bewusst
 * keinen externen Bezeichner (§19.1) und ist ueber `by-source` nicht adressierbar.
 *
 * Die Antwort haengt vom Anmeldenden ab - Rollen, Identitaet und Vier-Augen-Bezug beziehen
 * sich auf ihn. Innerhalb einer Sitzung ist das unkritisch; die Abmeldung fuehrt ueber eine
 * vollstaendige Navigation und verwirft den Zwischenspeicher mit der Seite.
 */
export function useUebergaenge(id: string) {
  return useQuery({
    queryKey: uebergaengeSchluessel(id),
    queryFn: async (): Promise<Uebergangsauskunft> => {
      const { data, response } = await api.GET("/v1/requirements/{id}/transitions", {
        params: { path: { id } },
      });

      if (data === undefined) {
        throw new Error(
          response.status === 401
            ? "Die Sitzung ist abgelaufen"
            : `Uebergaenge konnten nicht geladen werden (${response.status})`,
        );
      }

      return data;
    },
  });
}

export interface Zustandswechsel {
  id: string;
  toState: string;
  /** Nur noetig, wenn der Uebergang eine Begruendung verlangt (`requiresReason`). */
  reason?: string;
}

export function useZustandswechsel() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: Zustandswechsel): Promise<void> => {
      const { error, response } = await api.PUT("/v1/requirements/{id}/state", {
        params: { path: { id: eingabe.id } },
        body: { toState: eingabe.toState, reason: eingabe.reason },
      });

      if (response.ok) {
        return;
      }

      const rumpf = error as { conditions?: Bedingungsverstoss[]; message?: string } | undefined;

      if (rumpf?.conditions !== undefined) {
        throw new BedingungsFehler(rumpf.conditions);
      }

      throw new Error(rumpf?.message ?? `Zustandswechsel fehlgeschlagen (${response.status})`);
    },
    onSuccess: async (_ergebnis, eingabe) => {
      await Promise.all([
        abfrageClient.invalidateQueries({ queryKey: anforderungenSchluessel }),
        abfrageClient.invalidateQueries({ queryKey: uebergaengeSchluessel(eingabe.id) }),
      ]);
    },
  });
}
export interface Zustandszuordnung {
  id: string;
  state: string;
  reason: string;
}

/**
 * Setzt den Zustand auf einen des geltenden Graphen (ADR-0022 Punkt 5).
 *
 * **Kein Uebergang.** Fuer Anforderungen, deren aktueller Zustand im Graphen nicht
 * vorkommt - ohne diesen Vorgang bleiben sie stehen, und die Oberflaeche sagt es ihnen,
 * ohne einen Ausweg anzubieten.
 */
export function useZustandZuordnen() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: Zustandszuordnung): Promise<void> => {
      const { error, response } = await api.PUT("/v1/requirements/{id}/state/assignment", {
        params: { path: { id: eingabe.id } },
        body: { state: eingabe.state, reason: eingabe.reason },
      });

      if (!response.ok) {
        const rumpf = error as { message?: string } | undefined;
        throw new Error(rumpf?.message ?? `Zuordnung fehlgeschlagen (${response.status})`);
      }
    },
    onSuccess: async (_ergebnis, eingabe) => {
      await Promise.all([
        abfrageClient.invalidateQueries({ queryKey: anforderungenSchluessel }),
        abfrageClient.invalidateQueries({ queryKey: uebergaengeSchluessel(eingabe.id) }),
      ]);
    },
  });
}

export interface Fassungshebung {
  id: string;
  reason: string;
}

/** Hebt eine laufende Anforderung auf die aktuelle Fassung ihres Workflows (ADR-0025). */
export function useFassungHeben() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: Fassungshebung): Promise<void> => {
      const { error, response } = await api.PUT("/v1/requirements/{id}/workflow-version", {
        params: { path: { id: eingabe.id } },
        body: { reason: eingabe.reason },
      });

      if (!response.ok) {
        const rumpf = error as { message?: string } | undefined;
        throw new Error(rumpf?.message ?? `Heben fehlgeschlagen (${response.status})`);
      }
    },
    onSuccess: async (_ergebnis, eingabe) => {
      await Promise.all([
        abfrageClient.invalidateQueries({ queryKey: anforderungenSchluessel }),
        abfrageClient.invalidateQueries({ queryKey: uebergaengeSchluessel(eingabe.id) }),
      ]);
    },
  });
}
