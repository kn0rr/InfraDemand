// Vorgabewerte, damit Testdateien ohne eigene Keycloak-Konfiguration
// die Anwendung ueberhaupt hochfahren koennen. Einzelne Tests ueberschreiben sie.
process.env["KEYCLOAK_ISSUER_URL"] ??= "http://127.0.0.1:1/realms/test";
process.env["KEYCLOAK_AUDIENCE"] ??= "requirement-api";
