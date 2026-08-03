# Produktionsreife – offene Punkte

Dieses Dokument sammelt **alles, was geändert werden muss, bevor die Plattform in einer
produktiven Umgebung betrieben werden darf.**

Der Grund für seine Existenz: In der Entwicklung werden laufend bewusste Abkürzungen
genommen – unverschlüsselte Verbindungen, triviale Zugangsdaten, abgeschaltete
Sicherheitsmechanismen. Jede einzelne ist für sich vertretbar und im Moment ihrer
Entstehung offensichtlich. Sechs Monate später ist sie es nicht mehr. Ohne diese Liste
gehen genau die Punkte verloren, deren Vergessen am teuersten ist.

---

## Pflegeregel

> **Diese Datei wird fortgeschrieben, sobald ein neues Thema auftaucht.**
>
> Wird eine Entwicklungsabkürzung genommen, ein Sicherheitsmechanismus abgeschaltet, ein
> Standardwert übernommen oder ein Punkt auf „später" vertagt, wird er **im selben
> Arbeitsschritt** hier eingetragen – nicht am Ende des Meilensteins und nicht kurz vor
> dem Produktivgang.
>
> Ein Eintrag wird nie gelöscht. Er wechselt seinen Status auf `Erledigt`, mit Datum und
> Verweis auf die umsetzende Änderung. Nur so bleibt nachvollziehbar, dass ein Risiko
> bewusst geschlossen und nicht übersehen wurde.

Das gilt für alle Beteiligten, einschließlich der KI in ihrer Beraterrolle
(CLAUDE.md §0): Wer eine Abkürzung vorschlägt, trägt sie hier ein.

---

## Legende

**Status:** `Offen` · `In Arbeit` · `Erledigt` · `Bewusst akzeptiert`

**Schwere:**

| Stufe | Bedeutung |
|---|---|
| **Kritisch** | Produktivgang ist ohne Umsetzung ausgeschlossen. Direktes Sicherheits- oder Datenverlustrisiko. |
| **Hoch** | Produktivgang nur mit dokumentierter, befristeter Ausnahme und Kompensationsmaßnahme. |
| **Mittel** | Muss vor dem Regelbetrieb umgesetzt sein, blockiert aber keinen begrenzten Pilotbetrieb. |

---

## Stand

| Bereich | Einträge | davon kritisch |
|---|---|---|
| A – Transportverschlüsselung und Netzwerk | 7 | 5 |
| B – Geheimnisse und Zugangsdaten | 5 | 5 |
| C – Identität und Zugriff | 5 | 2 |
| D – Daten | 4 | 3 |
| E – Container und Lieferkette | 5 | 1 |
| F – Betrieb und Verfügbarkeit | 5 | 1 |
| G – Anwendungssicherheit | 4 | 1 |
| **Gesamt** | **35** | **18** |

Stand 2026-08-03: kein Eintrag erledigt. Das ist erwartbar – die Plattform befindet sich
in Meilenstein M0.

---

## A – Transportverschlüsselung und Netzwerk

#### PROD-001 — Keycloak läuft im Entwicklungsmodus ohne TLS
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `command: ["start-dev", ...]`

`start-dev` schaltet HTTPS ab und deaktiviert die strikte Hostnamen-Prüfung. Tokens und
Anmeldedaten gehen im Klartext über die Leitung.

**Zielzustand:** `start` mit `KC_HOSTNAME`, `KC_HTTPS_CERTIFICATE_FILE` bzw. TLS-Abschluss
am Ingress, `KC_HOSTNAME_STRICT=true`, `KC_PROXY_HEADERS=xforwarded` bei vorgelagertem
Proxy.

#### PROD-002 — Realm erzwingt kein HTTPS
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `sslRequired: "none"`

**Zielzustand:** `"all"`. Der Wert `"external"` ist nur zulässig, wenn nachweislich
ausschließlich vertrauenswürdige interne Netze unverschlüsselt zugreifen – was mit dem in
§13 geforderten Zero-Trust-Modell unvereinbar ist.

#### PROD-003 — Keine gegenseitige TLS-Authentifizierung zwischen Services
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

§13 fordert mTLS zwischen Services und ein Zero-Trust-Netzwerkmodell. Derzeit existiert
weder das eine noch das andere; Service-zu-Service-Aufrufe sind bislang ohnehin nicht
implementiert.

**Zielzustand:** mTLS über ein Service Mesh oder eine eigene Zertifikatsverwaltung
(cert-manager). Entscheidung fällig, sobald der zweite Service existiert.

#### PROD-004 — Datenbankverbindungen sind unverschlüsselt
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `KC_DB_URL`

Die Verbindungszeichenfolge enthält keine TLS-Parameter. Zugangsdaten und Nutzdaten
gehen im Klartext zur Datenbank.

**Zielzustand:** `sslmode=verify-full` mit hinterlegter Zertifizierungsstelle für alle
Datenbankverbindungen, einschließlich der von Keycloak.

#### PROD-005 — Keycloak-Verwaltungsport ist nach außen abgebildet
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `ports: "9000:9000"`

Port 9000 liefert Health- und Metrikendaten. Er darf ausschließlich clusterintern
erreichbar sein.

**Zielzustand:** Keine Port-Abbildung nach außen; Zugriff nur durch Prometheus und die
Orchestrierungsschicht.

#### PROD-006 — Keine Netzwerkrichtlinien
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13, §14

Ohne NetworkPolicies kann jeder Pod jeden anderen erreichen. Ein kompromittierter Dienst
hat damit unmittelbaren Zugriff auf alle Datenbanken.

**Zielzustand:** Standardverweigerung, danach ausschließlich explizit erlaubte
Verbindungen – insbesondere darf ein Service nur seine eigene Datenbank erreichen
([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)).

#### PROD-007 — CORS-Ursprünge zeigen auf localhost
**Schwere:** Mittel · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `webOrigins`, `redirectUris`

**Zielzustand:** Umgebungsspezifische Werte über Variablenersetzung in
`keycloak-config-cli`. Platzhalterwerte wie `*` sind unzulässig.

---

## B – Geheimnisse und Zugangsdaten

#### PROD-008 — Datenbankzugangsdaten stehen im Klartext im Repository
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/postgres/init/01-databases.sql`, `infra/local/compose.yaml`

Rollen und Passwörter (`keycloak`/`keycloak`, `requirement`/`requirement`) sind fest
hinterlegt. Für die lokale Umgebung bewusst so gewählt und dort unbedenklich.

**Zielzustand:** Erzeugung und Verteilung über HashiCorp Vault. Kein Zugangsdatum in
irgendeiner Form im Repository, auch nicht in Vorlagen.

#### PROD-009 — Keycloak-Administrator ist `admin`/`admin`
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `KC_BOOTSTRAP_ADMIN_*`

**Zielzustand:** Einmaliges Bootstrap-Konto mit erzeugtem Passwort aus Vault,
unmittelbar nach der Einrichtung deaktiviert. Verwaltungszugriff danach ausschließlich
über personengebundene Konten mit zweitem Faktor.

#### PROD-010 — Kein Geheimnisverwaltungssystem vorhanden
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

§13 benennt HashiCorp Vault. Es existiert bislang keine Anbindung.

**Zielzustand:** Vault mit automatischer Erneuerung, kurzlebigen Datenbankzugangsdaten
und Anbindung an die Orchestrierungsschicht. Fällig vor der ersten nicht-lokalen
Umgebung.

#### PROD-011 — Testbenutzer mit Passwort im Realm hinterlegt
**Schwere:** Kritisch · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `users`

Der Benutzer `test.author` mit dem Passwort `test` ist Bestandteil der Realm-Definition
und würde bei unveränderter Anwendung in jede Umgebung mitwandern.

**Zielzustand:** Testbenutzer in eine getrennte, ausschließlich lokal angewandte
Ergänzungsdatei auslagern. Die Basis-Realm-Definition enthält keine Benutzer.

#### PROD-012 — Client-Geheimnisse noch nicht externalisiert
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §4, §13

Sobald Service Accounts angelegt werden ([ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)),
entstehen vertrauliche Clients mit Geheimnissen.

**Zielzustand:** Variablenersetzung in `keycloak-config-cli`
(`IMPORT_VARSUBSTITUTION_ENABLED=true`), Werte aus Vault. Umzusetzen **bevor** der erste
Service Account entsteht – nachträglich bedeutet es, ein bereits im Verlauf der
Versionsgeschichte veröffentlichtes Geheimnis auszutauschen.

---

## C – Identität und Zugriff

#### PROD-013 — Passwort-Grant am Frontend-Client aktiviert
**Schwere:** Kritisch · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `directAccessGrantsEnabled: true`

Bewusst aktiviert, damit Integrationstests ohne Browser-Anmeldefluss ein Token beziehen
können. In einer produktiven Umgebung umgeht dieser Grant sämtliche
Anmeldeflusssicherungen einschließlich zweitem Faktor.

**Zielzustand:** `false`. Tests in nicht-lokalen Umgebungen verwenden einen eigenen
Testclient, nicht den Frontend-Client.

#### PROD-014 — Keine Passwortrichtlinie, kein zweiter Faktor
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** Passwortrichtlinie im Realm, zweiter Faktor verpflichtend für
`platform-admin`, empfohlen für alle übrigen Rollen.

#### PROD-015 — Kein Schutz gegen automatisiertes Durchprobieren
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** Brute-Force-Erkennung im Realm aktiviert, mit abgestimmten
Sperrzeiten.

#### PROD-016 — Token-Lebensdauern nicht abgestimmt
**Schwere:** Mittel · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `accessTokenLifespan: 300`

Der Wert ist gesetzt, aber nicht gegen ein Widerrufskonzept abgestimmt. Ohne Widerruf
bleibt ein entwendetes Token bis zum Ablauf gültig.

**Zielzustand:** Abgestimmte Lebensdauern für Zugriffs-, Erneuerungs- und Sitzungstoken,
dokumentiertes Widerrufsverfahren, Prüfung gegen die Rollenkritikalität.

#### PROD-017 — Feingranulare Autorisierung fehlt
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §8 · **Verweis:** [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)

Objekt- und Feldebene aus §8 ist noch nicht umgesetzt; die Policy-Engine ist bewusst bis
M5 vertagt. Ein Produktivgang vor M5 ist damit ausgeschlossen.

---

## D – Daten

#### PROD-018 — Keine Verschlüsselung im Ruhezustand
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)

**Zielzustand:** Verschlüsselte Speichervolumen, verschlüsselte Sicherungen, dokumentierte
Schlüsselverwaltung.

#### PROD-019 — Kein Sicherungs- und Wiederanlaufkonzept
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §15

Es existiert weder ein Sicherungsverfahren noch ein Nachweis, dass eine
Wiederherstellung funktioniert.

**Zielzustand:** Automatisierte Sicherung mit definierten Wiederherstellungszielen
(RPO/RTO), **regelmäßig geprüfte** Wiederherstellung. Eine ungeprüfte Sicherung ist keine
Sicherung.

#### PROD-020 — Kein Aufbewahrungs- und Löschkonzept
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13, §15

Die Plattform verarbeitet personenbezogene Daten (Antragsteller, Kommentare,
Auditeinträge). Es existiert kein Konzept für Aufbewahrungsfristen, Auskunft, Berichtigung
und Löschung.

**Zielzustand:** Dokumentiertes Konzept einschließlich der Frage, wie sich Löschung mit
der in §16 geforderten lückenlosen Auditierung verträgt – ein Zielkonflikt, der bewusst
aufzulösen ist.

#### PROD-021 — Datenbankrechte noch nicht minimal
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §8 · **Fundstelle:** `infra/local/postgres/init/01-databases.sql`

Die Servicerollen sind Eigentümer ihrer Datenbanken und dürfen dort alles, einschließlich
Schemaänderungen zur Laufzeit.

**Zielzustand:** Trennung zwischen Migrationsrolle (Schemaänderung) und Laufzeitrolle
(nur Datenzugriff). Damit kann eine kompromittierte Anwendung das Schema nicht verändern.

---

## E – Container und Lieferkette

#### PROD-022 — Images sind über Tags statt Prüfsummen festgelegt
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`

`postgres:18-alpine`, `quay.io/keycloak/keycloak:26.4` und
`adorsys/keycloak-config-cli:6.5.1-26` sind veränderliche Tags. Der Inhalt kann sich
unbemerkt ändern.

**Zielzustand:** Festlegung über Digest (`image@sha256:...`), Aktualisierung über
Renovate mit sichtbarer Änderung im Review.

#### PROD-023 — Container laufen als root, Dateisystem beschreibbar
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation:
false`, alle Capabilities entzogen.

#### PROD-024 — Keine Ressourcenbegrenzungen
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §15

Ohne Begrenzung kann ein einzelner Dienst den Knoten erschöpfen.

**Zielzustand:** Angeforderte und maximale Werte für CPU und Speicher je Dienst.

#### PROD-025 — Kein automatisiertes Sicherheits-Scanning
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Geplant:** M0, Schritt 3

§13 fordert Abhängigkeits-Scanning, Container-Scanning (Trivy) sowie SAST und DAST in
CI/CD. Bislang existiert keine Pipeline.

#### PROD-026 — Keine Stückliste, keine Signatur
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** SBOM je Image, signierte Images, Prüfung der Signatur beim Ausrollen.

---

## F – Betrieb und Verfügbarkeit

#### PROD-027 — Keycloak ohne Hochverfügbarkeit
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §15 · **Verweis:** [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)

Keycloak ist eine zentrale Abhängigkeit. Fällt es aus, ist die gesamte Plattform nicht
nutzbar.

**Zielzustand:** Mehrere Instanzen mit verteiltem Sitzungs-Cache, Token-Zwischenspeicher
in den Services, definiertes Verhalten bei nicht erreichbarem Identitätsanbieter.

#### PROD-028 — PostgreSQL ohne Replikation
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §15

**Zielzustand:** Replikation mit automatischem Failover, Wiederherstellung auf einen
Zeitpunkt.

#### PROD-029 — Keine Bereitschafts- und Lebendigkeitsprüfungen
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §14

**Zielzustand:** Getrennte Endpunkte für Lebendigkeit und Bereitschaft je Service; die
Bereitschaft berücksichtigt Datenbank- und Identitätsanbieter-Erreichbarkeit.

#### PROD-030 — Keine Dienstgüteziele definiert
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §15

§15 fordert definierte SLOs. Ohne sie ist weder Alarmierung noch Kapazitätsplanung für
die Plattform selbst möglich.

#### PROD-031 — Keine Beobachtbarkeit
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §14 · **Geplant:** M1

§14 fordert OpenTelemetry, Prometheus, Grafana und Loki. Zusätzlich fehlt eine
Alarmierung für sicherheitsrelevante Ereignisse – fehlgeschlagene Anmeldungen,
Berechtigungsverweigerungen, ungewöhnliche Service-Account-Aktivität (§13).

---

## G – Anwendungssicherheit

#### PROD-032 — Keine Begrenzung der Anfragerate
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §12, §13

§12 sieht öffentliche Lese-APIs vor. Ohne Begrenzung sind sie unmittelbar für
Überlastung und massenhaftes Auslesen offen.

**Zielzustand:** Begrenzung je API-Client und je Identität, am Ingress und zusätzlich im
Service.

#### PROD-033 — Keine Sicherheitsheader im Frontend
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Geplant:** M2

**Zielzustand:** Content Security Policy, `Strict-Transport-Security`,
`X-Content-Type-Options`, `Referrer-Policy`, restriktive `Permissions-Policy`.

#### PROD-034 — Fehlerantworten noch nicht auf Informationspreisgabe geprüft
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0005](../adr/0005-api-first-workflow.md)

Das Fehlerformat nach RFC 9457 ist festgelegt, der Inhalt aber nicht. Stapelverfolgungen,
Datenbankfehler und interne Kennungen dürfen nicht nach außen gelangen.

**Zielzustand:** Einheitlicher Ausnahmefilter, der interne Details protokolliert und nach
außen ausschließlich Fehlerklasse und Vorgangskennung zurückgibt.

#### PROD-035 — Auditprotokoll nicht manipulationsgeschützt
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §16 · **Verweis:** [ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md)

Auditeinträge liegen zunächst in derselben Datenbank wie die Fachdaten und mit denselben
Rechten. Wer schreiben darf, kann sie verändern – womit sie als Nachweis wertlos wären.

**Zielzustand:** Nur-Anfügen-Rechte für die Laufzeitrolle, getrennte Aufbewahrung,
definierte Aufbewahrungsfrist. Zu klären gemeinsam mit PROD-020.

---

## Verwendung

**Vor jedem Produktivgang** wird diese Liste durchgegangen. Ein Eintrag mit Schwere
`Kritisch` und Status `Offen` blockiert den Produktivgang – ohne Ermessensspielraum.

**Beim Eintragen** wird die nächste freie Nummer vergeben und der Eintrag in den passenden
Bereich einsortiert. Die Zusammenfassungstabelle wird mitgeführt.

**Beim Schließen** wechselt der Status auf `Erledigt (JJJJ-MM-TT, <Commit oder PR>)`. Der
Eintrag bleibt stehen.

**Bei bewusster Annahme eines Risikos** wechselt der Status auf `Bewusst akzeptiert`, mit
Begründung, Entscheider und Überprüfungsdatum. Ein kritischer Eintrag kann nicht bewusst
akzeptiert werden.
