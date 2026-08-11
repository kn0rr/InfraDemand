"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requirementClient } from "./client";
import type { components } from "./schema";

export type Workflow = components["schemas"]["WorkflowDefinitionResponse"];
export type NeuerWorkflow = components["schemas"]["CreateWorkflowDefinitionDto"];
export type WorkflowAenderung = components["schemas"]["UpdateWorkflowDefinitionDto"];
export type Fassungsnutzung = components["schemas"]["WorkflowVersionUsageResponse"];

export const workflowsSchluessel = ["workflows"] as const;

const api = requirementClient();

export function useWorkflows() {
  return useQuery({
    queryKey: workflowsSchluessel,
    queryFn: async (): Promise<Workflow[]> => {
      const { data, response } = await api.GET("/v1/workflow-definitions");

      if (data === undefined) {
        throw new Error(`Workflows konnten nicht geladen werden (${response.status})`);
      }

      return data;
    },
  });
}

/**
 * Welche Fassungen mit wie vielen Anforderungen in Gebrauch sind (ADR-0025 Punkt 3).
 *
 * Vor jeder Aenderung die Frage, die zaehlt: Wie viele Anforderungen erreicht eine
 * Berichtigung nicht, weil sie an eine aeltere Fassung gebunden sind (§7)?
 */
export function useFassungsnutzung(id: string | null) {
  return useQuery({
    queryKey: ["fassungsnutzung", id ?? ""],
    enabled: id !== null,
    queryFn: async (): Promise<Fassungsnutzung[]> => {
      const { data, response } = await api.GET("/v1/workflow-definitions/{id}/usage", {
        params: { path: { id: id ?? "" } },
      });

      if (data === undefined) {
        throw new Error(`Fassungsnutzung nicht ladbar (${response.status})`);
      }

      return data;
    },
  });
}

/**
 * Der Dienst weist einen widerspruechlichen Graphen mit einer Meldung ab, die die
 * Fundstelle nennt - `transitions[1].to: "erfunden" ist kein angelegter Zustand`.
 *
 * Sie wird durchgereicht, nicht ersetzt. Eine eigene Formulierung waere allgemeiner und
 * damit schlechter; die Graphpruefung sagt genauer, was fehlt, als es hier stuende.
 */
function meldung(fehler: unknown, ersatz: string): string {
  const rumpf = fehler as { message?: string | string[] } | undefined;

  if (Array.isArray(rumpf?.message)) {
    return rumpf.message.join("; ");
  }

  return rumpf?.message ?? ersatz;
}

export function useWorkflowAnlegen() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: NeuerWorkflow): Promise<Workflow> => {
      const { data, error, response } = await api.POST("/v1/workflow-definitions", {
        body: eingabe,
      });

      if (data === undefined) {
        throw new Error(
          response.status === 409
            ? "Fuer diesen Anforderungstyp besteht bereits ein Workflow"
            : meldung(error, `Anlegen fehlgeschlagen (${response.status})`),
        );
      }

      return data;
    },
    onSuccess: async () => {
      await abfrageClient.invalidateQueries({ queryKey: workflowsSchluessel });
    },
  });
}

export function useWorkflowAendern() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...eingabe
    }: WorkflowAenderung & { id: string }): Promise<Workflow> => {
      const { data, error, response } = await api.PUT("/v1/workflow-definitions/{id}", {
        params: { path: { id } },
        body: eingabe,
      });

      if (data === undefined) {
        throw new Error(meldung(error, `Aendern fehlgeschlagen (${response.status})`));
      }

      return data;
    },
    onSuccess: async (_ergebnis, eingabe) => {
      await Promise.all([
        abfrageClient.invalidateQueries({ queryKey: workflowsSchluessel }),
        abfrageClient.invalidateQueries({ queryKey: ["fassungsnutzung", eingabe.id] }),
      ]);
    },
  });
}
