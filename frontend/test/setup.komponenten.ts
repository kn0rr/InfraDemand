import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library raeumt nach jedem Test selbst auf - aber nur, wenn Vitest mit `globals`
 * laeuft. Hier werden `describe` und `it` ausdruecklich importiert, also muss die
 * Bereinigung ausdruecklich sein. Ohne sie rendert jeder Test in dasselbe Dokument, und
 * die Abfragen finden die Knoepfe der vorherigen mit.
 */
afterEach(cleanup);

/**
 * jsdom kennt `matchMedia` nicht; Mantine fragt es beim Aufbau ab, um das Farbschema zu
 * bestimmen.
 *
 * Die Antwort ist bewusst starr: Fuer die geprueften Fragen - welche Schaltflaeche
 * erscheint, mit welchem Grund - spielt das Farbschema keine Rolle. Eine bewegliche
 * Nachbildung waere Aufwand fuer eine Eigenschaft, die kein Test befragt.
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (abfrage: string) => ({
    matches: false,
    media: abfrage,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

/**
 * jsdom kennt `ResizeObserver` nicht; Mantine misst damit die Hoehe seiner Auswahllisten.
 *
 * Die Nachbildung tut nichts. Fuer die geprueften Fragen - welche Bedingung gemeldet wird,
 * was beim Wechsel der Art uebrig bleibt - spielt die tatsaechliche Groesse keine Rolle.
 */
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
