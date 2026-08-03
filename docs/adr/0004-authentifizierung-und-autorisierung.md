# ADR-0004: Authentifizierung und Autorisierung

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §4, §5, §8, §13, §16
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§8 verlangt ein feingranulares Berechtigungsmodell: RBAC als Basis, ABAC auf Objekt-,
Feld- und Aktionsebene, Mandantenfähigkeit nach Projekt, Organisation, Region und
Kostenstelle, Policy-as-Code – versioniert, testbar, auditierbar. Diese Regeln gelten für
UI, API und Service-zu-Service-Aufrufe gleichermaßen.

§4 verlangt, dass Service-zu-Service-Interaktionen über **dedizierte Service Accounts**
laufen, jeweils mit minimalen Rechten und eigener Auditspur – ausdrücklich kein
gemeinsamer System-Account.

§5 nennt einen eigenen „Identity & Access Service" als fachlichen Service.

Security by Design (§2) bedeutet, dass diese Mechanismen ab dem ersten Endpunkt greifen
und nicht nachgerüstet werden. Nachträglich eingeführte Autorisierung ist der teuerste
denkbare Umbau.

## Entscheidung

**Keycloak** ist der Identity Provider der Plattform. Lokal wird Keycloak 26.4 verwendet.

Festlegungen im Einzelnen:

1. **Authentifizierung** erfolgt über OpenID Connect. Services validieren JWTs gegen den
   JWKS-Endpunkt des Realms. Die Validierung ist ab dem **ersten** Endpunkt aktiv, nicht
   ab einem späteren Meilenstein.
2. **Service Accounts** werden als Keycloak-Clients mit aktiviertem
   Client-Credentials-Grant abgebildet – je aufrufendem Service ein eigener Client mit
   eigenen Rollen. Kein geteilter technischer Account.
3. **Die Realm-Konfiguration ist versionierter Bestandteil des Repositories.** Sie liegt
   als Realm-Export unter `infra/local/keycloak/import/` und wird beim Start importiert.
   Manuell in der Admin-Konsole vorgenommene Änderungen gelten als nicht existent, bis
   sie exportiert und eingecheckt sind.
4. **Der Identity & Access Service aus §5 hält keine eigenen Benutzerdaten.** Er ist eine
   fachliche Fassade über die Keycloak-Admin-API für die Verwaltung von Rollen,
   Zuordnungen und Service Accounts sowie für die Auditierung von
   Berechtigungsänderungen. Ein zweiter Benutzerbestand wird nicht aufgebaut.
5. **Grobgranulare Autorisierung** (Rollen, Mandantenzuordnung) wird aus den Ansprüchen
   des Tokens abgeleitet.
6. **Feingranulare Autorisierung** auf Objekt- und Feldebene (§8) wird über eine
   dedizierte Policy-Engine gelöst. **Deren Auswahl ist Teil dieser Entscheidung
   ausdrücklich nicht** und wird in Meilenstein M5 als eigenes ADR getroffen.

## Begründung

**Keycloak ist in CLAUDE.md §8 als bevorzugter Baustein genannt** und erfüllt §1 als
Apache-2.0-lizenzierte Open-Source-Software.

**Client Credentials Grant bildet §4 direkt ab.** Jeder Service erhält eine eigene
Identität mit eigenen Rollen; jeder Zugriff ist dem aufrufenden Service zuzuordnen. Das
ist die Voraussetzung für die in §13 geforderte Auditierung der Service-Account-Aktivität.

**Realm-Konfiguration als Code.** §2 fordert vollständige Nachvollziehbarkeit von
Änderungen. Eine ausschließlich in der Admin-Konsole gepflegte Realm-Konfiguration wäre
weder versioniert noch reproduzierbar noch überprüfbar. Der Import-Export-Weg macht die
Identitätskonfiguration zu einem prüfbaren Artefakt.

**Trennung von Authentifizierung und Autorisierung.** Keycloak beantwortet „wer bist du"
zuverlässig. Die Frage „darfst du Feld X an Objekt Y in Projekt Z ändern" gehört
architektonisch nicht in den Identity Provider, sondern in eine Policy-Engine mit
versionierten, testbaren Regeln. Diese Trennung hält beide Teile austauschbar.

## Betrachtete Alternativen

### Eigene Benutzerverwaltung im Identity & Access Service

Nicht gewählt. Passwort-Hashing, Token-Ausgabe, Sitzungsverwaltung, MFA,
Passwortrücksetzung und Protokollanbindung selbst zu bauen ist aufwendig und
sicherheitskritisch. §1 verlangt Open Source, nicht Eigenbau.

### Ory Kratos/Hydra statt Keycloak

Modular und API-orientiert, sauber getrennte Komponenten.

Nicht gewählt, weil es mehrere separat zu betreibende Dienste erfordert, während Keycloak
Benutzerverwaltung, OIDC-Provider, Rollenmodell und Administrationsoberfläche in einer
Komponente mitbringt. Bei einer Ein-Personen-Umsetzung ist die geringere Zahl beweglicher
Teile ausschlaggebend. Keycloak ist zudem in CLAUDE.md ausdrücklich genannt.

## Konsequenzen

### Positiv

- Authentifizierung, Benutzerverwaltung und Service Accounts stehen ab M0 bereit.
- Jeder Service-zu-Service-Aufruf ist einer eigenen Identität zuzuordnen.
- Die Identitätskonfiguration ist reproduzierbar und in der Codeprüfung sichtbar.

### Negativ und Risiken

- **Keycloak ist eine zentrale Abhängigkeit.** Fällt es aus, ist die gesamte Plattform
  nicht nutzbar. Für produktionsnahe Umgebungen ist ein Hochverfügbarkeitsbetrieb und
  eine Token-Caching-Strategie erforderlich (§15).
- **Der lokale Betrieb läuft mit `start-dev`.** Damit sind HTTPS und strikte
  Hostnamen-Prüfung abgeschaltet. Das ist ausschließlich lokal zulässig; §13 verlangt für
  jede andere Umgebung mTLS und Verschlüsselung im Transport.
- **Die lokalen Administrator-Zugangsdaten stehen im Klartext im Repository.** Rein
  lokale Gültigkeit; für alle anderen Umgebungen gilt §13 (Vault).
- **Feldebenen-Autorisierung ist noch offen.** Bis zur Entscheidung in M5 darf keine
  provisorische, verstreute Rechteprüfung entstehen, die später überall aufzuräumen wäre.
  Zwischenlösung: Berechtigungsprüfungen ausschließlich in NestJS-Guards, an einer Stelle
  gebündelt und damit später austauschbar.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Policy-Engine: Open Policy Agent oder OpenFGA | M5, eigenes ADR |
| Ausgestaltung der Mandantenfähigkeit (Ansprüche im Token vs. Abfrage zur Laufzeit) | M5 |
| Token-Lebensdauer, Erneuerung, Widerruf | M2, mit dem Frontend-Durchstich |
| Hochverfügbarkeit und Sicherung von Keycloak | Vor der ersten produktionsnahen Umgebung |

Entscheidungskriterien für die Policy-Engine, damit die Wahl in M5 nicht bei null
beginnt: OPA passt zu regelbasierten, attributgetriebenen Entscheidungen (Rego, gut
testbar, Policy-as-Code im engeren Sinn). OpenFGA passt zu beziehungsbasierten
Berechtigungen („Nutzer ist Genehmiger von Projekt X"). Da §8 sowohl attribut- als auch
objektbezogene Regeln fordert, ist die tatsächliche Gewichtung erst mit dem konkreten
Berechtigungsbedarf aus M3 und M4 beurteilbar.
