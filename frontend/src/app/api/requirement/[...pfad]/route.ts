import { holeSitzung } from "@/lib/auth/sitzung.server";
import { frischesZugriffstoken } from "@/lib/auth/token";
import { erforderlich } from "@/lib/auth/umgebung";
import { anfrageKopfzeilen, antwortKopfzeilen, zielUrl } from "@/lib/bff/weiterleitung";

interface Kontext {
  params: Promise<{ pfad: string[] }>;
}

/** Fehlerformat nach RFC 9457, wie in ADR-0005 festgelegt. */
function problem(status: number, titel: string): Response {
  return new Response(JSON.stringify({ title: titel, status }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

async function weiterleiten(anfrage: Request, kontext: Kontext): Promise<Response> {
  const sitzung = await holeSitzung();
  const zugriffstoken = await frischesZugriffstoken(sitzung);
  if (zugriffstoken === undefined) {
    return problem(401, "Nicht angemeldet");
  }

  const { pfad } = await kontext.params;

  // Die Basisadresse ist Konfiguration, kein Bestandteil der Anfrage. Fehlt sie, ist
  // das ein Fehler des Servers - ihn zusammen mit den Pfadfehlern als 400 zu melden,
  // schickt die Fehlersuche an die falsche Stelle. Die Ausnahme bleibt hier ungefangen
  // und wird zu einem 500 mit Eintrag im Serverprotokoll.
  const basis = erforderlich("REQUIREMENT_API_URL");

  let ziel: URL;
  try {
    ziel = zielUrl(basis, pfad, new URL(anfrage.url).search);
  } catch {
    return problem(400, "Unzulaessiger Pfad");
  }

  // Der Rumpf wird gepuffert statt durchgereicht: Ein Strom als fetch-Rumpf verlangt
  // `duplex: "half"` und braechte fuer JSON-Nutzlasten keinen Vorteil.
  const rumpf =
    anfrage.method === "GET" || anfrage.method === "HEAD" ? undefined : await anfrage.arrayBuffer();

  let antwort: Response;
  try {
    antwort = await fetch(ziel, {
      method: anfrage.method,
      headers: anfrageKopfzeilen(anfrage.headers, zugriffstoken),
      body: rumpf,
      // Keiner Weiterleitung des Service folgen - das Ziel waere nicht mehr geprueft.
      redirect: "manual",
    });
  } catch {
    return problem(502, "Der Service ist nicht erreichbar");
  }

  return new Response(antwort.body, {
    status: antwort.status,
    headers: antwortKopfzeilen(antwort.headers),
  });
}

export const GET = weiterleiten;
export const POST = weiterleiten;
export const PUT = weiterleiten;
export const PATCH = weiterleiten;
export const DELETE = weiterleiten;
