"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requirementClient } from "./client";
import type { components } from "./schema";

export type Attributdefinition = components["schemas"]["AttributeDefinitionResponse"];
export type NeueAttributdefinition = components["schemas"]["CreateAttributeDefinitionDto"];
export type GeaenderteAttributdefinition = components["schemas"]["UpdateAttributeDefinitionDto"];
export type Hoheitsregel = components["schemas"]["MastershipRuleResponse"];
export type NeueHoheitsregel = components["schemas"]["CreateMastershipRuleDto"];
export type Festhaltung = components["schemas"]["FesthaltungUebersicht"];

const api = requirementClient();

const SCHLUESSEL = {
  definitionen: ["verwaltung", "attributdefinitionen"] as const,
  regeln: ["verwaltung", "hoheitsregeln"] as const,
  festhaltungen: ["verwaltung", "festhaltungen"] as const,
};

/** Alle Definitionen, auch die ausser Kraft gesetzten - die Verwaltung zeigt den Bestand. */
export function useAlleAttributdefinitionen() {
  return useQuery({
    queryKey: SCHLUESSEL.definitionen,
    queryFn: async (): Promise<Attributdefinition[]> => {
      const { data, response } = await api.GET("/v1/attribute-definitions");
      if (data === undefined) {
        throw new Error(`Nicht ladbar (${response.status})`);
      }
      return data;
    },
  });
}

export function useAlleHoheitsregeln() {
  return useQuery({
    queryKey: SCHLUESSEL.regeln,
    queryFn: async (): Promise<Hoheitsregel[]> => {
      const { data, response } = await api.GET("/v1/mastership-rules");
      if (data === undefined) {
        throw new Error(`Nicht ladbar (${response.status})`);
      }
      return data;
    },
  });
}

export function useFesthaltungen() {
  return useQuery({
    queryKey: SCHLUESSEL.festhaltungen,
    queryFn: async (): Promise<Festhaltung[]> => {
      const { data, response } = await api.GET("/v1/requirements/holds");
      if (data === undefined) {
        throw new Error(
          response.status === 403
            ? "Fuer diese Uebersicht fehlt die Berechtigung"
            : `Nicht ladbar (${response.status})`,
        );
      }
      return data;
    },
  });
}

/** Meldung des Service statt einer eigenen - er kennt den Grund, die Oberflaeche nicht. */
async function fehlermeldung(error: unknown, status: number): Promise<string> {
  const rumpf = error as { message?: unknown } | undefined;
  return typeof rumpf?.message === "string" ? rumpf.message : `Fehlgeschlagen (${status})`;
}

export function useAttributdefinitionAnlegen() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: NeueAttributdefinition): Promise<Attributdefinition> => {
      const { data, error, response } = await api.POST("/v1/attribute-definitions", {
        body: eingabe,
      });
      if (data === undefined) {
        throw new Error(await fehlermeldung(error, response.status));
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SCHLUESSEL.definitionen });
    },
  });
}

export function useAttributdefinitionAendern() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: {
      id: string;
      werte: GeaenderteAttributdefinition;
    }): Promise<Attributdefinition> => {
      const { data, error, response } = await api.PUT("/v1/attribute-definitions/{id}", {
        params: { path: { id: eingabe.id } },
        body: eingabe.werte,
      });
      if (data === undefined) {
        throw new Error(await fehlermeldung(error, response.status));
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SCHLUESSEL.definitionen });
    },
  });
}

export function useHoheitsregelAnlegen() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: NeueHoheitsregel): Promise<Hoheitsregel> => {
      const { data, error, response } = await api.POST("/v1/mastership-rules", { body: eingabe });
      if (data === undefined) {
        throw new Error(await fehlermeldung(error, response.status));
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SCHLUESSEL.regeln });
    },
  });
}

export function useHoheitsregelAendern() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: {
      id: string;
      mode: Hoheitsregel["mode"];
    }): Promise<Hoheitsregel> => {
      const { data, error, response } = await api.PUT("/v1/mastership-rules/{id}", {
        params: { path: { id: eingabe.id } },
        body: { mode: eingabe.mode },
      });
      if (data === undefined) {
        throw new Error(await fehlermeldung(error, response.status));
      }
      return data;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SCHLUESSEL.regeln });
    },
  });
}
