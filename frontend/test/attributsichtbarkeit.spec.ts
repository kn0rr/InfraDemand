import { describe, expect, it } from "vitest";
import { type Attributdefinition, istSichtbar } from "@/lib/api/attributdefinitionen";

const definition = (visibleFor: string[] | null): Attributdefinition =>
  ({ key: "kosten", visibleFor }) as unknown as Attributdefinition;

describe("istSichtbar", () => {
  it("ohne Angabe fuer alle", () => {
    expect(istSichtbar(definition(null), [])).toBe(true);
  });

  it("leere Liste wie keine Angabe", () => {
    expect(istSichtbar(definition([]), [])).toBe(true);
  });

  it("mit passender Rolle sichtbar", () => {
    expect(istSichtbar(definition(["controller"]), ["controller"])).toBe(true);
  });

  it("ohne passende Rolle unsichtbar", () => {
    expect(istSichtbar(definition(["controller"]), ["requirement-author"])).toBe(false);
  });

  it("eine von mehreren genuegt", () => {
    expect(istSichtbar(definition(["personal", "vorstand"]), ["vorstand"])).toBe(true);
  });
});
