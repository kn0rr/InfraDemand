# Architekturentscheidungen (ADRs)

Ein Architecture Decision Record hält **eine** Entscheidung mit struktureller Wirkung
fest: den Kontext, die getroffene Wahl, die Begründung, die verworfenen Alternativen und
die Konsequenzen.

Der Zweck ist nicht Formalismus, sondern die in CLAUDE.md Abschnitt 2 geforderte
*vollständige Nachvollziehbarkeit von Entscheidungen*. Ein Jahr später ist die Frage
nicht „was steht im Code", sondern „warum steht es dort und was haben wir dafür
aufgegeben".

## Wann ein ADR geschrieben wird

Ein ADR ist fällig, wenn eine Entscheidung mindestens eines dieser Merkmale hat:

- Sie ist teuer zurückzunehmen (Datenmodell, Sprachwahl, Protokoll, Identitätssystem).
- Sie wirkt über einen einzelnen Service hinaus.
- Sie weicht von einer Vorgabe aus CLAUDE.md ab oder legt eine dort offene Frage fest.
- Jemand könnte sie später sinnvoll anzweifeln.

Kein ADR nötig für: Bibliotheksauswahl ohne strukturelle Wirkung, Formatierungsfragen,
Umsetzungsdetails innerhalb eines Service.

## Prozess

1. Neue Datei aus [`0000-template.md`](0000-template.md) anlegen, fortlaufend nummeriert.
2. Status auf `Vorgeschlagen` setzen und die Entscheidung ausformulieren.
3. Nach Annahme Status auf `Angenommen` setzen und in die Tabelle unten eintragen.
4. **Ein angenommenes ADR wird inhaltlich nicht mehr geändert.** Ändert sich die
   Entscheidung, entsteht ein neues ADR, und das alte erhält den Status
   `Ersetzt durch ADR-XXXX`. Nur so bleibt die Historie lesbar.

Zulässige Status: `Vorgeschlagen`, `Angenommen`, `Abgelehnt`, `Ersetzt durch ADR-XXXX`,
`Überholt`.

## Index

| Nr. | Titel | Status | Datum |
|---|---|---|---|
| [0001](0001-backend-sprache-und-framework.md) | Backend-Sprache und Framework | Angenommen | 2026-07-31 |
| [0002](0002-repository-struktur.md) | Repository-Struktur: Monorepo | Angenommen | 2026-07-31 |
| [0003](0003-datenbank-und-datenhoheit.md) | Datenbank und Datenhoheit je Service | Angenommen | 2026-07-31 |
| [0004](0004-authentifizierung-und-autorisierung.md) | Authentifizierung und Autorisierung | Angenommen | 2026-07-31 |
| [0005](0005-api-first-workflow.md) | API-First-Workflow mit OpenAPI 3.1 | Angenommen | 2026-07-31 |
| [0006](0006-typescript-version-und-modulsemantik.md) | TypeScript-Version und Modulsemantik | Angenommen | 2026-07-31 |
| [0007](0007-inkrementeller-aufbau-der-servicelandschaft.md) | Inkrementeller Aufbau der Servicelandschaft | Angenommen | 2026-07-31 |
| [0008](0008-teststrategie-und-testinfrastruktur.md) | Teststrategie und Testinfrastruktur | Angenommen | 2026-08-04 |

## Offene, bewusst vertagte Entscheidungen

Diese Punkte sind erkannt, aber noch nicht entscheidungsreif. Sie werden zum genannten
Zeitpunkt als eigenes ADR nachgezogen.

| Thema | Vertagt bis | Referenz |
|---|---|---|
| ORM und Migrationswerkzeug (Drizzle vs. MikroORM) | Meilenstein M1 | [ADR-0003](0003-datenbank-und-datenhoheit.md) |
| Policy-Engine für Feldebene (OPA vs. OpenFGA) | Meilenstein M5 | [ADR-0004](0004-authentifizierung-und-autorisierung.md) |
| Regel-Engine für Workflow-Übergänge (JSONLogic vs. json-rules-engine) | Meilenstein M4 | [ADR-0001](0001-backend-sprache-und-framework.md) |
| Messaging-Backbone (Kafka vs. NATS) | Sobald der zweite Service existiert | CLAUDE.md §12 |
| Umstieg auf TypeScript 7 (nativer Compiler) | Nach M1, wenn das NestJS-Tooling nachgezogen hat | [ADR-0006](0006-typescript-version-und-modulsemantik.md) |
