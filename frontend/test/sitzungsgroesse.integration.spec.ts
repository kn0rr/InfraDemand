import { sealData } from "iron-session";
import { describe, expect, it } from "vitest";
import { type Sitzungsinhalt, sitzungsOptionen } from "@/lib/auth/sitzung";

/**
 * Browser verwerfen Cookies ueber 4096 Byte stillschweigend - ohne Fehler, ohne
 * Meldung, die Anmeldung greift einfach nicht mehr. Die Grenze liegt hier darunter,
 * damit der Test anschlaegt, solange noch Handlungsspielraum besteht (PROD-045).
 */
const GRENZE_BYTE = 3600;

async function holeEchteToken(): Promise<{ zugriff: string; erneuerung: string }> {
  const aussteller = process.env["KEYCLOAK_ISSUER_URL"];
  if (aussteller === undefined || aussteller === "") {
    throw new Error("KEYCLOAK_ISSUER_URL fehlt - laeuft die lokale Infrastruktur?");
  }

  const antwort = await fetch(`${aussteller}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "test-cli",
      username: "test.author",
      password: "test",
      grant_type: "password",
      scope: "openid profile email",
    }),
  });

  if (!antwort.ok) {
    throw new Error(`Keycloak antwortete mit ${antwort.status}`);
  }

  const inhalt = (await antwort.json()) as {
    access_token: string;
    refresh_token: string;
  };
  return { zugriff: inhalt.access_token, erneuerung: inhalt.refresh_token };
}

describe("Groesse des Sitzungscookies", () => {
  it("bleibt unter der Grenze, ab der ein Browser das Cookie verwirft", async () => {
    const token = await holeEchteToken();

    // Derselbe Inhalt, den der Rueckruf schreibt.
    const inhalt: Sitzungsinhalt = {
      quelle: "infrademand",
      zugriffstoken: token.zugriff,
      erneuerungstoken: token.erneuerung,
      gueltigBis: Date.now() + 300_000,
      subjekt: "00000000-0000-4000-8000-000000000000",
      benutzername: "test.author",
      anzeigename: "Test Author",
      rollen: ["requirement-author"],
      mandanten: ["t-eins"],
    };

    const optionen = sitzungsOptionen();
    const versiegelt = await sealData(inhalt, {
      password: optionen.password,
      ttl: optionen.ttl,
    });

    // Der Browser rechnet Name und Wert zusammen gegen sein Limit.
    const groesse = `${optionen.cookieName}=${versiegelt}`.length;

    // Die Zahl gehoert in die Ausgabe: Der Test soll nicht nur sagen, dass es passt,
    // sondern wie knapp - das ist die Kennzahl aus PROD-045.
    console.info(`Sitzungscookie: ${groesse} von 4096 Byte (Grenze ${GRENZE_BYTE})`);

    expect(groesse).toBeLessThan(GRENZE_BYTE);
  });
});
