// Vorgabewerte, damit Testdateien ohne eigene Keycloak-Konfiguration
// die Anwendung ueberhaupt hochfahren koennen. Einzelne Tests ueberschreiben sie.
process.env["KEYCLOAK_ISSUER_URL"] ??= "http://127.0.0.1:1/realms/test";
process.env["KEYCLOAK_AUDIENCE"] ??= "requirement-api";
// Wird nie verbunden. Tests, die tatsaechlich Daten brauchen, setzen den Wert in
// beforeAll auf ihren Testcontainer; der Pool baut die Verbindung erst bei der
// ersten Abfrage auf.
process.env["DATABASE_URL"] ??= "postgresql://unused:unused@127.0.0.1:1/unused";
// Der Sidecar laeuft in den schnellen Tests nicht. Der Wert muss nur gesetzt sein, damit
// `OpaClient` sich ueberhaupt bauen laesst - `getOrThrow` greift im Konstruktor, also
// beim Hochfahren von AppModule. Ein Aufruf dagegen scheitert, und das ist richtig so.
process.env["OPA_URL"] ??= "http://127.0.0.1:1";
