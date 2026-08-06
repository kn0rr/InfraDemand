/**
 * Kopfzeilen, die vom Browser an den Service weitergereicht werden.
 *
 * Bewusst eine Positivliste. Bei einer Negativliste waere jede kuenftige Kopfzeile
 * standardmaessig durchgereicht, und die Frage, ob sie das darf, stellte sich nie.
 */
const ANFRAGE_DURCHREICHEN = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-none-match",
]);

/** Kopfzeilen, die vom Service an den Browser zurueckgereicht werden. */
const ANTWORT_DURCHREICHEN = new Set(["content-type", "etag", "cache-control"]);

export function zielUrl(basis: string, segmente: readonly string[], suche: string): URL {
  if (segmente.length === 0) {
    throw new Error("Leerer Pfad");
  }
  for (const segment of segmente) {
    // Next liefert die Segmente bereits dekodiert. Ein ".." kaeme damit ungeprueft in
    // die Ziel-URL und koennte aus dem vorgesehenen Pfad herausfuehren.
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(`Unzulaessiges Pfadsegment: ${segment}`);
    }
  }

  const ziel = new URL(
    `${basis.replace(/\/+$/, "")}/${segmente.map(encodeURIComponent).join("/")}`,
  );
  ziel.search = suche;
  return ziel;
}

export function anfrageKopfzeilen(eingehend: Headers, zugriffstoken: string): Headers {
  const kopfzeilen = new Headers();
  for (const [name, wert] of eingehend) {
    if (ANFRAGE_DURCHREICHEN.has(name.toLowerCase())) {
      kopfzeilen.set(name, wert);
    }
  }
  // Nach der Schleife, damit eine mitgeschickte Authorization-Kopfzeile sie nicht
  // ueberschreiben kann. Das Sitzungscookie erreicht den Service nie - er kennt
  // ausschliesslich das serverseitig gehaltene Token (ADR-0014).
  kopfzeilen.set("authorization", `Bearer ${zugriffstoken}`);
  return kopfzeilen;
}

export function antwortKopfzeilen(eingehend: Headers): Headers {
  const kopfzeilen = new Headers();
  for (const [name, wert] of eingehend) {
    if (ANTWORT_DURCHREICHEN.has(name.toLowerCase())) {
      kopfzeilen.set(name, wert);
    }
  }
  return kopfzeilen;
}
