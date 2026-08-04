# Architekturüberblick

**Geltungsstand:** 2026-07-31, Meilenstein M0.

Dieses Dokument beschreibt das Zielbild der Plattform und den Weg dorthin. Die
verbindlichen fachlichen Anforderungen stehen in [`../../CLAUDE.md`](../../CLAUDE.md);
die Begründungen einzelner Festlegungen in [`../adr/`](../adr/README.md).

---

## 1. Zielbild

Die Plattform nimmt Projektanforderungen strukturiert auf, verwaltet sie über ihren
gesamten Lebenszyklus und verbindet sie mit der Kapazitäts- und Infrastrukturplanung des
Betreibers.

Zwei Zielgruppen mit unterschiedlichen Sichten auf dieselben Daten:

- **Anwender** erfassen und verfolgen Anforderungen und benötigen Transparenz über Status,
  Fortschritt und Entscheidungen.
- **Plattformbetreiber** benötigen eine Gesamtsicht, Kapazitätsplanung,
  Ressourcensteuerung und Prognosen künftiger Hardwarebedarfe.

Aus dieser Doppelrolle folgt die zentrale technische Eigenschaft der Plattform:
**dieselben Daten, unterschiedlich sichtbar und unterschiedlich änderbar, gesteuert über
ein feingranulares Berechtigungsmodell** (CLAUDE.md §8).

---

## 2. Tragende Architekturmerkmale

Vier Eigenschaften prägen den Entwurf stärker als alles andere. Sie sind die Merkmale,
an denen sich jede Entwurfsentscheidung messen lassen muss.

### Konfigurierbarkeit ohne Neuausrollung

Anforderungsattribute (§6), Workflows (§7), Bereitstellungskategorien (§17), Service-Typen
und Overhead-Modelle (§18) sind **Fachdaten, nicht Code**. Sie werden über
Administrationsoberflächen gepflegt und zur Laufzeit ausgewertet.

Konsequenz für den Entwurf: Validierung erfolgt gegen zur Laufzeit geladene Definitionen
(JSON Schema), nicht gegen zur Bauzeit festgelegte Typen. Zustandsübergänge werden aus
gespeicherten Zustandsgraphen abgeleitet, nicht aus `switch`-Anweisungen.

### Versionierung von Definitionen, nicht nur von Daten

Attributdefinitionen, Workflow-Definitionen und Overhead-Modelle sind versioniert. Eine
laufende Anforderung bleibt auf der Version, unter der sie begonnen wurde (§7); Änderungen
am Overhead-Modell wirken ausschließlich auf neue Bestellungen (§18).

Konsequenz: Jedes Fachobjekt führt einen Verweis auf die Definitionsversion mit, gegen die
es zu bewerten ist. Definitionen werden nie überschrieben, sondern fortgeschrieben.

### Lückenlose Nachvollziehbarkeit

Jede Schreiboperation – aus der Oberfläche, über die API oder durch einen Service Account
– wird historisiert und auditiert, einschließlich Herkunft sowie altem und neuem Wert
(§16).

Konsequenz: Der Audit-Schreibpfad ist Bestandteil des Schreibvorgangs, kein
nachgelagerter Nebeneffekt. Er wird an einer Stelle je Service umgesetzt
(NestJS-Interceptor), nicht in jedem Handler.

### Identität für Menschen und Maschinen

Service-zu-Service-Aufrufe laufen über dedizierte Service Accounts mit eigenen, minimal
notwendigen Rechten und eigener Auditspur (§4). Kein gemeinsamer technischer Account.

Konsequenz: Autorisierung wird nicht zwischen „Benutzeraufruf" und „interner Aufruf"
unterschieden. Es gibt nur Identitäten mit Rechten.

---

## 3. Systemüberblick

```mermaid
graph TB
    subgraph Klienten
        UI[Next.js Frontend]
        EXT[Externe API-Konsumenten]
    end

    subgraph Identität
        KC[Keycloak<br/>OIDC, Benutzer, Service Accounts]
    end

    subgraph Fachliche Services
        REQ[Requirement Service]
        IAM[Identity &amp; Access Service]
        INF[Infrastructure Service]
        CAP[Capacity Service]
        AUD[Audit Service]
    end

    subgraph Daten
        PG[(PostgreSQL<br/>je Service eigene DB)]
    end

    UI -->|OIDC Login| KC
    UI -->|REST, JWT| REQ
    EXT -->|REST, JWT| REQ

    REQ -->|Token-Validierung via JWKS| KC
    IAM -->|Admin-API| KC

    REQ -.->|Service Account| INF
    CAP -.->|Service Account| INF
    REQ -.->|Audit-Ereignisse| AUD
    CAP -.->|Audit-Ereignisse| AUD

    REQ --> PG
    IAM --> PG
    INF --> PG
    CAP --> PG
    AUD --> PG
```

Durchgezogene Linien sind Aufrufe im Namen eines Benutzers, gestrichelte Linien
Service-zu-Service-Aufrufe über Service Accounts.

**Wichtig:** Das Diagramm zeigt das Zielbild. Zum aktuellen Stand existiert keiner der
fachlichen Services. Zur Reihenfolge siehe Abschnitt 5 und
[ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md).

---

## 4. Technische Grundlagen

| Ebene | Festlegung | Begründung |
|---|---|---|
| Frontend | TypeScript, React, Next.js | CLAUDE.md §3 |
| Backend | TypeScript, NestJS (Fastify) | [ADR-0001](../adr/0001-backend-sprache-und-framework.md) |
| Forecasting | Python-Worker im Capacity Service | [ADR-0001](../adr/0001-backend-sprache-und-framework.md) |
| Datenhaltung | PostgreSQL, je Service eigene Datenbank und Rolle | [ADR-0003](../adr/0003-datenbank-und-datenhoheit.md) |
| Identität | Keycloak, OIDC, Client Credentials für Service Accounts | [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md) |
| Schnittstellen | REST, OpenAPI 3.1, Versionierung über den Pfad | [ADR-0005](../adr/0005-api-first-workflow.md) |
| Repository | Monorepo, pnpm Workspaces | [ADR-0002](../adr/0002-repository-struktur.md) |

Sämtliche Bestandteile stehen unter Open-Source-Lizenzen (CLAUDE.md §1).

---

## 5. Umsetzungsstrategie

Die Servicegrenzen gelten ab dem ersten Commit vollständig; die Services entstehen
nacheinander. Die Begründung steht in
[ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md).

| Meilenstein | Inhalt | Stand |
|---|---|---|
| **M0** | Fundament: Monorepo, lokale Infrastruktur, CI, Entscheidungen als ADRs | in Arbeit |
| **M1** | Walking Skeleton Requirement Service: Kernentität, Authentifizierung, Migrationen, Audit-Pfad, Integrationstests | offen |
| **M2** | Frontend-Durchstich: Anmeldung, Liste, Anlegen, generierter API-Client | offen |
| **M3** | Dynamisches Attributmodell (§6) | offen |
| **M4** | Workflow-Engine (§7) | offen |
| **M5** | Feingranulares Berechtigungsmodell (§8), Identity & Access Service | offen |
| **M6** | Infrastructure Service, Bereitstellungskategorien und Service-Katalog (§17, §18) | offen |
| **M7** | Capacity Service, Overhead-Berechnung und Forecasting (§9, §18) | offen |
| **M8** | Audit Service als eigenständiger Dienst, Reporting (§10), Visualisierung (§11) | offen |

### Warum diese Reihenfolge

**M1 vor allem anderen**, weil der vertikale Durchstich sämtliche Querschnittsfragen
einmal an einem echten Beispiel beantwortet: Migrationen, Integrationstests gegen eine
echte Datenbank, Token-Validierung, Audit-Schreibpfad, Container-Build, CI. Bei parallel
begonnenen Services würde jede dieser Fragen mehrfach und uneinheitlich beantwortet.

**Requirement Service vor Identity & Access Service**, weil Authentifizierung,
Benutzerverwaltung und Service Accounts von Keycloak bereits ab M0 bereitgestellt werden.
Der eigene Service wird erst gebraucht, wenn Berechtigungen über Rollen im Token
hinausgehen.

**Dynamische Attribute (M3) und Berechtigungsmodell (M5) bewusst spät**, weil sie die
fachlich schwierigsten Teile sind. Sie benötigen ein belastbares Fundament, sonst werden
sie zweimal gebaut. Das Datenmodell aus M1 darf sie jedoch nicht ausschließen – die
Kernentität trägt das dynamische Attributfeld von Beginn an, auch wenn zunächst nichts
darin validiert wird.

---

## 6. Querschnittsthemen

### Authentifizierung und Autorisierung

Ab dem **ersten** Endpunkt aktiv, nicht ab einem späteren Meilenstein (Security by
Design, §2). Grobgranulare Prüfung aus Token-Ansprüchen; die Prüfung auf Objekt- und
Feldebene folgt in M5 über eine Policy-Engine. Bis dahin liegen sämtliche
Berechtigungsprüfungen ausschließlich in NestJS-Guards, damit sie später an einer Stelle
austauschbar sind.

### Auditierung

Einheitliches Audit-Ereignisschema ab M1. Bis zur Herauslösung des Audit Service in M8
schreibt jeder Service seine Ereignisse in die eigene Datenbank. Die spätere Herauslösung
überträgt damit Daten und Schreibpfad, statt das Konzept nachträglich zu erfinden.

### Beobachtbarkeit

OpenTelemetry ab M1, auch solange nur ein Dienst existiert. Ablaufverfolgung
nachzurüsten, wenn bereits mehrere Dienste miteinander sprechen, ist deutlich aufwendiger
als sie von Beginn an mitzuführen.

### Fehlerformat

RFC 9457 (`application/problem+json`), einheitlich über alle Services
([ADR-0005](../adr/0005-api-first-workflow.md)).

---

## 7. Bewusst offene Punkte

Diese Fragen sind erkannt und absichtlich noch nicht beantwortet. Die vollständige Liste
mit Zeitpunkten steht in [`../adr/README.md`](../adr/README.md#offene-bewusst-vertagte-entscheidungen).

- ORM und Migrationswerkzeug (M1)
- Policy-Engine für die Feldebene (M5)
- Regel-Engine für Workflow-Übergänge (M4)
- Messaging-Backbone zwischen Services (sobald der zweite Service existiert)
- Reporting-Lesemodell: eigenes Modell oder vorgefertigte Lösung wie Metabase (M8)

---

## 8. Weiterführend

- Verantwortlichkeiten und Datenhoheit je Service: [`services.md`](services.md)
- Einrichtung der Entwicklungsumgebung: [`../development/installation.md`](../development/installation.md)
- Werkzeugkette und Konventionen: [`../development/tooling.md`](../development/tooling.md)
