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
| [0009](0009-orm-und-migrationswerkzeug.md) | ORM und Migrationswerkzeug: Drizzle | Angenommen | 2026-08-05 |
| [0010](0010-entkopplung-anforderung-und-kapazitaet.md) | Entkopplung von Anforderungsaufnahme und Kapazitätsberechnung | Angenommen | 2026-08-05 |
| [0011](0011-datenhoheit-je-feld-und-kontext.md) | Datenhoheit je Feld und Kontext | Angenommen | 2026-08-05 |
| [0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) | Vollständige Versionierung mit Zeitbezug | Angenommen | 2026-08-05 |
| [0013](0013-frontend-zuschnitt-und-zugriffsweg.md) | Frontend-Zuschnitt und Zugriffsweg | Angenommen, Punkt 2 ersetzt durch 0014 | 2026-08-05 |
| [0014](0014-frontend-authentifizierung-ueber-bff.md) | Frontend-Authentifizierung über ein Backend-for-Frontend | Angenommen | 2026-08-06 |
| [0015](0015-mehrere-identitaetsquellen.md) | Mehrere Identitätsquellen über Brokering statt mehrerer Aussteller | Angenommen | 2026-08-06 |
| [0016](0016-ui-grundlage-und-datenzugriff-im-frontend.md) | UI-Grundlage Mantine und Datenzugriff über TanStack Query | Angenommen | 2026-08-06 |
| [0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) | Regelvokabular der Datenhoheit und Begriff des Mandanten | Angenommen | 2026-08-06 |
| [0018](0018-vollstaendigkeit-und-loeschung-an-der-importgrenze.md) | Vollständigkeit und Löschung an der Importgrenze | Angenommen | 2026-08-07 |
| [0019](0019-verhalten-bei-abgewiesener-schreiboperation.md) | Verhalten bei abgewiesener Schreiboperation | Angenommen | 2026-08-07 |
| [0020](0020-lebenszyklus-der-infrastruktur.md) | Lebenszyklus der Infrastruktur – Maßnahme und abgeleiteter Bestandszustand | Angenommen | 2026-08-11 |
| [0021](0021-anbindung-externer-workflows.md) | Anbindung externer Workflows | Angenommen | 2026-08-11 |
| [0022](0022-statuswechsel-als-eigener-vorgang.md) | Statuswechsel als eigener Vorgang und Pflicht zum Workflow | Angenommen | 2026-08-11 |
| [0023](0023-workflow-bindung-beim-typwechsel.md) | Workflow-Bindung beim Wechsel der Anforderungsart | Angenommen | 2026-08-11 |

## Offene, bewusst vertagte Entscheidungen

Diese Punkte sind erkannt, aber noch nicht entscheidungsreif. Sie werden zum genannten
Zeitpunkt als eigenes ADR nachgezogen.

| Thema | Vertagt bis | Referenz |
|---|---|---|
| Audit-Ereignisschema und Schreibpfad | Meilenstein M1.4 | [ADR-0009](0009-orm-und-migrationswerkzeug.md) |
| Wahl des wirksamen Mandanten bei Mehrfachzugehörigkeit | Meilenstein M5 | [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) |
| Rückmeldung abgewiesener Felder an einen Import | Mit dem Dateiimport | [ADR-0019](0019-verhalten-bei-abgewiesener-schreiboperation.md) |
| Ab wann die Kompatibilitätsgarantie aus §12 gilt – und wie eine begründete Ausnahme davor aussieht | **Vor dem ersten Produktivgang** | CLAUDE.md §12, `PROD-049` |
| Befristung von Festhaltungen – verfällt eine Festhaltung von selbst? | Wenn Erfahrung aus dem Betrieb vorliegt | [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) Teil B |
| Ablage der Sitzung: Cookie oder serverseitiger Speicher – und welcher, ohne ADR-0002 zu verletzen | Vor Meilenstein M3 | [ADR-0014](0014-frontend-authentifizierung-ueber-bff.md), `PROD-045` |
| Policy-Engine für Feldebene (OPA vs. OpenFGA) | Meilenstein M5 | [ADR-0004](0004-authentifizierung-und-autorisierung.md) |
| Regel-Engine für Workflow-Übergänge (JSONLogic vs. json-rules-engine) | Meilenstein M4.3 | [ADR-0001](0001-backend-sprache-und-framework.md), [ADR-0022](0022-statuswechsel-als-eigener-vorgang.md) |
| Abbildung der Workflow-Zustände auf das stabile Statusvokabular des Vertrags | Wenn der Capacity Service angebunden wird | [ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md), [ADR-0022](0022-statuswechsel-als-eigener-vorgang.md) |
| Ist „abgeschlossen" der erreichte Endzustand oder ein eigenes Merkmal der Anforderung? | Meilenstein M4.3 | [ADR-0022](0022-statuswechsel-als-eigener-vorgang.md) |
| Gültigkeitszeit als zweite Zeitachse – durch [ADR-0020](0020-lebenszyklus-der-infrastruktur.md) von optional zu **erforderlich** geworden | Vor Meilenstein M6 | [ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) Punkt 7 |
| Zustandsnamen der Bestandsobjekte: Fachdaten oder Code | Meilenstein M6 | [ADR-0020](0020-lebenszyklus-der-infrastruktur.md) |
| Speicherung von Szenarien: Auswahl von Maßnahmen oder eigene, nicht genehmigte Maßnahmen | Meilenstein M7 | [ADR-0020](0020-lebenszyklus-der-infrastruktur.md) |
| Workflow-Maschine als geteiltes Paket unter `packages/` | Sobald der Infrastructure Service sie braucht (M6) | CLAUDE.md §5, §7 |
| Zuordnung eingehender Rueckmeldungen zum wartenden Vorgang | Meilenstein M4.3 | [ADR-0021](0021-anbindung-externer-workflows.md) |
| Abgleich fremdgefuehrter Vorgaenge, falls Rueckmeldungen ausbleiben | Wenn die erste Fremdanbindung steht | [ADR-0021](0021-anbindung-externer-workflows.md) |
| Messaging-Backbone (Kafka vs. NATS) | Sobald der zweite Service existiert | CLAUDE.md §12 |
| Diagrammbibliothek (Recharts vs. ECharts) | Mit dem ersten Dashboard | [ADR-0016](0016-ui-grundlage-und-datenzugriff-im-frontend.md) |
| Umstieg auf TypeScript 7 (nativer Compiler) | Nach M1, wenn das NestJS-Tooling nachgezogen hat | [ADR-0006](0006-typescript-version-und-modulsemantik.md) |
