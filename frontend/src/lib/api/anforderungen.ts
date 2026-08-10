"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requirementClient } from "./client";
import type { components } from "./schema";

export type Anforderung = components["schemas"]["RequirementResponse"];
export type NeueAnforderung = components["schemas"]["CreateRequirementDto"];

/**
 * Der Service beanstandet einzelne Attribute (§6). Die Meldungen sind feldbezogen, damit
 * das Formular alle auf einmal anzeigen kann statt eines nach dem anderen.
 */
export class AttributFehler extends Error {
  constructor(readonly attribute: { key: string; message: string }[]) {
    super("Dynamische Attribute genuegen den geltenden Definitionen nicht");
    this.name = "AttributFehler";
  }
}

/**
 * Ein Schluessel, an genau einer Stelle. Weicht der Schluessel der Neuvalidierung vom
 * Schluessel der Abfrage ab, bleibt die Liste nach dem Anlegen stehen - ohne Fehler,
 * nur mit veralteten Daten.
 */
export const anforderungenSchluessel = ["anforderungen"] as const;

// Der Client ist zustandslos; eine Instanz je Modul genuegt.
const api = requirementClient();

export function useAnforderungen() {
  return useQuery({
    queryKey: anforderungenSchluessel,
    queryFn: async (): Promise<Anforderung[]> => {
      const { data, response } = await api.GET("/v1/requirements");
      if (data === undefined) {
        throw new Error(
          response.status === 401
            ? "Die Sitzung ist abgelaufen"
            : `Anforderungen konnten nicht geladen werden (${response.status})`,
        );
      }
      return data;
    },
  });
}

export function useAnforderungAnlegen() {
  const abfrageClient = useQueryClient();

  return useMutation({
    mutationFn: async (eingabe: NeueAnforderung): Promise<Anforderung> => {
      const { data, error, response } = await api.POST("/v1/requirements", { body: eingabe });

      if (data === undefined) {
        const rumpf = error as { attributes?: { key: string; message: string }[] } | undefined;

        if (rumpf?.attributes !== undefined) {
          throw new AttributFehler(rumpf.attributes);
        }

        throw new Error(
          response.status === 409
            ? "Eine Anforderung mit dieser Herkunft besteht bereits (§19.1)"
            : `Anlegen fehlgeschlagen (${response.status})`,
        );
      }

      return data;
    },
    onSuccess: async () => {
      await abfrageClient.invalidateQueries({ queryKey: anforderungenSchluessel });
    },
  });
}
