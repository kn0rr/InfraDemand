import "@mantine/core/styles.css";

import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Anbieter } from "./anbieter";

export const metadata: Metadata = {
  title: "InfraDemand",
  description: "Anforderungs- und Kapazitaetsmanagement",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // `mantineHtmlProps` setzt das Farbschema-Attribut und unterdrueckt die
  // Hydrationswarnung, die entsteht, weil `ColorSchemeScript` das Attribut vor
  // React schreibt.
  return (
    <html lang="de" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Anbieter>{children}</Anbieter>
      </body>
    </html>
  );
}
