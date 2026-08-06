/**
 * Zugriff auf die Prozessumgebung.
 *
 * `noPropertyAccessFromIndexSignature` aus tsconfig.base.json verbietet
 * `process.env.NAME`; der Zugriff laeuft deshalb ueber die Indexschreibweise.
 */
export function erforderlich(name: string): string {
  const wert = process.env[name];
  if (wert === undefined || wert === "") {
    throw new Error(`Umgebungsvariable ${name} fehlt. Lokal steht sie in infra/local/local.env.`);
  }
  return wert;
}

/** Basisadresse der Anwendung, ohne abschliessenden Schraegstrich. */
export function anwendungsBasisUrl(): string {
  return erforderlich("APP_BASE_URL").replace(/\/+$/, "");
}

/** Die eine registrierte Rueckrufadresse. Muss exakt zum Realm passen. */
export function rueckrufUrl(): string {
  return `${anwendungsBasisUrl()}/api/auth/callback`;
}
