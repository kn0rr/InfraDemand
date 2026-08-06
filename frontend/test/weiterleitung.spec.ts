import { describe, expect, it } from "vitest";
import { anfrageKopfzeilen, antwortKopfzeilen, zielUrl } from "@/lib/bff/weiterleitung";

describe("zielUrl", () => {
  it("setzt Pfad und Abfrage an die Basisadresse", () => {
    const ziel = zielUrl("http://localhost:3001", ["v1", "requirements"], "?status=neu");
    expect(ziel.href).toBe("http://localhost:3001/v1/requirements?status=neu");
  });

  it("vertraegt eine Basisadresse mit Schraegstrich am Ende", () => {
    expect(zielUrl("http://localhost:3001/", ["v1"], "").href).toBe("http://localhost:3001/v1");
  });

  it("weist Segmente zurueck, die aus dem Pfad herausfuehren", () => {
    expect(() => zielUrl("http://localhost:3001", ["v1", ".."], "")).toThrow();
    expect(() => zielUrl("http://localhost:3001", ["v1", "."], "")).toThrow();
    expect(() => zielUrl("http://localhost:3001", [], "")).toThrow();
  });

  it("kodiert Sonderzeichen im Segment", () => {
    expect(zielUrl("http://localhost:3001", ["v1", "a b"], "").pathname).toBe("/v1/a%20b");
  });
});

describe("anfrageKopfzeilen", () => {
  it("reicht das Sitzungscookie niemals an den Service weiter", () => {
    const eingehend = new Headers({
      cookie: "infrademand_sitzung=geheim",
      accept: "application/json",
    });
    const kopfzeilen = anfrageKopfzeilen(eingehend, "T");

    expect(kopfzeilen.get("cookie")).toBeNull();
    expect(kopfzeilen.get("accept")).toBe("application/json");
  });

  it("setzt das serverseitig gehaltene Token", () => {
    expect(anfrageKopfzeilen(new Headers(), "T").get("authorization")).toBe("Bearer T");
  });

  it("laesst eine vom Browser mitgeschickte Authorization-Kopfzeile nicht durch", () => {
    const eingehend = new Headers({ authorization: "Bearer fremd" });
    expect(anfrageKopfzeilen(eingehend, "T").get("authorization")).toBe("Bearer T");
  });
});

describe("antwortKopfzeilen", () => {
  it("reicht Set-Cookie des Service nicht an den Browser durch", () => {
    const eingehend = new Headers({
      "set-cookie": "sitzung=fremd",
      "content-type": "application/json",
    });
    const kopfzeilen = antwortKopfzeilen(eingehend);

    expect(kopfzeilen.get("set-cookie")).toBeNull();
    expect(kopfzeilen.get("content-type")).toBe("application/json");
  });
});
