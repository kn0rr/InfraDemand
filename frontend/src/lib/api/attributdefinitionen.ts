"use client";

import { useQuery } from "@tanstack/react-query";
import { requirementClient } from "./client";
import type { components } from "./schema";

export type Attributdefinition = components["schemas"]["AttributeDefinitionResponse"];
export type Hoheitsregel = components["schemas"]["MastershipRuleResponse"];

const api = requirementClient();

/**
 * Die fuer einen Anforderungstyp geltenden Definitionen - typbezogene und allgemeine.
 *
 * Ruht ohne Anforderungstyp: Ohne ihn gibt es keine geltende Menge, und eine Abfrage mit
 * leerem Wert lieferte den vollstaendigen Bestand statt nichts.
 */
export function useAttributdefinitionen(requirementType: string) {
  const typ = requirementType.trim();

  return useQuery({
    queryKey: ["attributdefinitionen", typ],
    enabled: typ !== "",
    queryFn: async (): Promise<Attributdefinition[]> => {
      const { data, response } = await api.GET("/v1/attribute-definitions", {
        params: { query: { requirementType: typ } },
      });

      if (data === undefined) {
        throw new Error(`Attributdefinitionen nicht ladbar (${response.status})`);
      }

      return data;
    },
  });
}

/**
 * Anforderungstypen, fuer die es Definitionen gibt.
 *
 * Es gibt keinen Katalog von Anforderungstypen - das Feld ist eine freie Zeichenkette.
 * Diese Liste ist deshalb ein Vorschlag aus dem Bestand, keine Auswahl: Ein neuer Typ
 * bleibt eingebbar.
 */
export function useBekannteAnforderungstypen() {
  return useQuery({
    queryKey: ["anforderungstypen"],
    queryFn: async (): Promise<string[]> => {
      const { data, response } = await api.GET("/v1/attribute-definitions");

      if (data === undefined) {
        throw new Error(`Attributdefinitionen nicht ladbar (${response.status})`);
      }

      const typen = data
        .map((definition) => definition.requirementType)
        .filter((typ): typ is string => typ !== null);

      return [...new Set(typen)].sort();
    },
  });
}

export function useHoheitsregeln() {
  return useQuery({
    queryKey: ["hoheitsregeln"],
    queryFn: async (): Promise<Hoheitsregel[]> => {
      const { data, response } = await api.GET("/v1/mastership-rules");

      if (data === undefined) {
        throw new Error(`Hoheitsregeln nicht ladbar (${response.status})`);
      }

      return data;
    },
  });
}
