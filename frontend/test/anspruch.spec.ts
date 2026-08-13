import { describe, expect, it } from "vitest";
import { mandanten, realmRollen } from "@/lib/auth/anspruch";

describe("realmRollen", () => {
  it("liest die Rollen aus realm_access", () => {
    expect(realmRollen({ realm_access: { roles: ["platform-admin"] } })).toEqual([
      "platform-admin",
    ]);
  });

  it("liefert eine leere Liste, wenn der Anspruch fehlt", () => {
    expect(realmRollen({})).toEqual([]);
  });
});

describe("mandanten", () => {
  it("liest den Anspruch der obersten Ebene", () => {
    expect(mandanten({ tenants: ["t-eins", "t-zwei"] })).toEqual(["t-eins", "t-zwei"]);
  });

  it("liest ihn NICHT aus realm_access", () => {
    // Die Verwechslung, die es im Dienst schon einmal gab. Sie faellt nirgends auf: Das
    // Formular ist dann nur nicht absendbar, ohne dass jemand von einem Anspruch erfaehrt.
    expect(mandanten({ realm_access: { roles: [] }, ...{} } as never)).toEqual([]);
    expect(mandanten(JSON.parse('{"realm_access":{"tenants":["t-eins"]}}'))).toEqual([]);
  });

  it("verwirft, was keine Zeichenkette ist", () => {
    expect(mandanten(JSON.parse('{"tenants":["t-eins",42,null,{"a":1}]}'))).toEqual(["t-eins"]);
  });

  it("liefert eine leere Liste, wenn der Anspruch fehlt", () => {
    // Der Fall, den ein Realm ohne Mapper erzeugt - derselbe wie „ohneZugehoerigkeit"
    // in mandant.integration.spec.ts.
    expect(mandanten({})).toEqual([]);
  });

  it("liefert eine leere Liste, wenn der Anspruch keine Liste ist", () => {
    expect(mandanten(JSON.parse('{"tenants":"t-eins"}'))).toEqual([]);
  });
});
