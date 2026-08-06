"use client";

import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function Anbieter({ children }: { children: ReactNode }): ReactNode {
  // Der Abfrage-Client entsteht einmal je Browsersitzung - nicht bei jedem Rendern,
  // und ausdruecklich nicht auf Modulebene: Ein Modul wird im Node-Prozess einmal
  // ausgewertet und von allen Anfragen geteilt. Ein dort erzeugter Zwischenspeicher
  // wuerde die Daten eines Anwenders an den naechsten weiterreichen.
  const [abfrageClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Ohne diesen Wert laedt jede Rueckkehr ins Fenster neu. Ueber den
            // Weiterleitungspfad kann das eine Tokenerneuerung ausloesen.
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={abfrageClient}>
      <MantineProvider defaultColorScheme="auto">{children}</MantineProvider>
    </QueryClientProvider>
  );
}
