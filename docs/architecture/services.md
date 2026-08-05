# Servicelandschaft

**Geltungsstand:** 2026-07-31, Meilenstein M0.

Dieses Dokument beschreibt die fachliche Verantwortung, Datenhoheit und
Abhängigkeitsstruktur der Services. Es ist die Referenz für die Frage „wohin gehört diese
Fachlichkeit".

Zum aktuellen Stand existiert ausschließlich der **Requirement Service**, und dieser erst
als Gerüst ohne Anwendungscode. Die Reihenfolge der Entstehung ist in
[ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md) festgelegt; die
Prüfliste zum Anlegen eines weiteren Service steht in
[service-setup.md](../development/service-setup.md).

---

## Verbindliche Regeln

Diese vier Regeln gelten für jeden Service ohne Ausnahme:

1. **Ein Service besitzt seine Daten allein.** Kein anderer Service greift auf seine
   Datenbank zu – weder lesend noch schreibend. Datenbankrollen setzen das technisch
   durch ([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)).
2. **Kein Code wird über Servicegrenzen hinweg importiert.** Gemeinsam genutzter Code
   liegt unter `packages/` ([ADR-0002](../adr/0002-repository-struktur.md)).
3. **Service-zu-Service-Aufrufe verwenden einen dedizierten Service Account** mit
   minimalen Rechten und eigener Auditspur (CLAUDE.md §4,
   [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)).
4. **Fachlichkeit wird nicht ersatzweise untergebracht.** Wird eine Fähigkeit gebraucht,
   deren Service noch nicht existiert, wird dieser Service gebaut – sie wandert nicht
   „vorläufig" in einen bestehenden.

---

## Requirement Service

**Meilenstein:** M1 · **Stand:** in Arbeit (M1.1) · **Paket:** [`services/requirement`](../../services/requirement/README.md)

### Verantwortung

Anforderungen, Projekte, Status und Lebenszyklus. Kommentare, Anhänge, Historisierung.
Verwaltung der Attributdefinitionen (§6) und der Workflow-Definitionen (§7). Bestellungen
als besondere Ausprägung einer Anforderung (§18).

### Datenhoheit

Datenbank `requirement`, Rolle `requirement`.

Wesentliche Entitäten:

| Entität | Zweck |
|---|---|
| `requirement` | Kernentität mit festen Feldern und dynamischem Attributfeld (JSONB) |
| `project` | Fachliche Klammer über Anforderungen |
| `attribute_definition` | Attributdefinitionen als Fachdaten, versioniert (§6) |
| `workflow_definition` | Zustandsgraphen als Fachdaten, versioniert (§7) |
| `comment`, `attachment` | Kommunikation und Belege |
| `requirement_history` | Historisierung jeder Änderung (§16) |

Die Kernentität trägt das dynamische Attributfeld **ab M1**, auch wenn die Validierung
erst in M3 entsteht. Das Datenmodell darf die spätere Erweiterung nicht ausschließen.

### Schnittstellen

`/v1/requirements`, `/v1/projects`, `/v1/attribute-definitions`, `/v1/workflows`.

Zusätzlich der Endpunkt, der das zu einem Anforderungstyp gehörende JSON Schema zur
Laufzeit ausliefert – die Grundlage dafür, dass Oberfläche und API identisch validieren
(§16, siehe [ADR-0001](../adr/0001-backend-sprache-und-framework.md), Abschnitt
„Design-Leitplanke").

### Abhängigkeiten

Keycloak (Token-Validierung). Ab M6 der Infrastructure Service für die Kapazitätsprüfung
bei Bestellungen – über Service Account.

---

## Identity & Access Service

**Meilenstein:** M5 · **Stand:** offen

### Verantwortung

Fachliche Verwaltung von Rollen, Rollenzuordnungen und Service Accounts. Auditierung von
Berechtigungsänderungen. Bereitstellung der Berechtigungsentscheidungen für die anderen
Services.

### Datenhoheit

Datenbank `identity`, Rolle `identity`.

**Der Service hält keine Benutzerdaten.** Benutzer, Anmeldedaten und Sitzungen liegen
ausschließlich in Keycloak; dieser Service ist eine fachliche Fassade über dessen
Administrations-API sowie der Ort, an dem projekt- und objektbezogene
Berechtigungsregeln (§8) verwaltet werden. Ein zweiter Benutzerbestand wird nicht
aufgebaut ([ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)).

### Abhängigkeiten

Keycloak Administrations-API. Policy-Engine (Auswahl in M5 offen).

---

## Infrastructure Service

**Meilenstein:** M6 · **Stand:** offen

### Verantwortung

Rechenzentren, Regionen, Standorte, Räume, Racks, Server, Netzwerkkomponenten.
Hardwaretemplates. Bereitstellungskategorien (§17), Service-Typ-Katalog und
Overhead-Modelle (§18). Kapazitätspools je Kategorie einschließlich Prüfung und
Reservierung.

### Datenhoheit

Datenbank `infrastructure`, Rolle `infrastructure`.

| Entität | Zweck |
|---|---|
| `datacenter`, `region`, `location`, `room`, `rack` | Standorthierarchie |
| `server`, `network_component` | Physische Bestände |
| `hardware_template` | Wiederverwendbare Ausstattungsvorlagen |
| `delivery_category` | Bereitstellungskategorien, versioniert (§17) |
| `service_type` | Service-Typ-Katalog je Kategorie, versioniert (§18) |
| `overhead_model` | Formeln und Faktoren je Service-Typ und Kategorie, versioniert (§18) |
| `capacity_pool` | Kapazitätspools je Kategorie |

Bereitstellungskategorien und Service-Typen sind Stammdaten und ohne Neuausrollung
erweiterbar. Overhead-Modelle sind zeitpunktbezogen versioniert; Änderungen wirken
ausschließlich auf neue Bestellungen und Prognosen, nicht rückwirkend.

### Abhängigkeiten

Keine fachlichen. Wird von Requirement Service und Capacity Service aufgerufen.

---

## Capacity Service

**Meilenstein:** M7 · **Stand:** offen

### Verantwortung

Kapazitäten und Ressourcenverbrauch. Berechnung der Bruttokapazität aus Nettoparametern
einer Bestellung und dem zugehörigen Overhead-Modell (§18). Auslastungsberechnung,
Wachstumsszenarien und Prognosen (§9).

### Datenhoheit

Datenbank `capacity`, Rolle `capacity`.

| Entität | Zweck |
|---|---|
| `consumption_timeseries` | Historische Verbrauchsdaten als Zeitreihe |
| `forecast_run` | Prognoselauf mit Modell, Annahmen und Zeitpunkt |
| `scenario` | Was-wäre-wenn-Szenarien |
| `capacity_calculation` | Ergebnis einer Brutto-Berechnung, mit Verweis auf die verwendete Overhead-Modellversion |

Prognoseergebnisse sind nachvollziehbar: Modell, Annahmen und Zeitpunkt werden mit dem
Ergebnis gespeichert (§9). Ein Prognoseergebnis ohne diese Angaben ist wertlos, weil es
nicht überprüfbar ist.

### Besonderheit: Forecasting-Worker

Die Prognoserechnung erfolgt in einem **Python-Worker**
([ADR-0001](../adr/0001-backend-sprache-und-framework.md)), gekapselt hinter einer
internen Schnittstelle. Der Worker ist kein eigenständiger fachlicher Service, sondern
eine Rechenkomponente des Capacity Service, und läuft außerhalb des Request-Pfads.

### Abhängigkeiten

Infrastructure Service (Overhead-Modelle, Kapazitätspools) über Service Account.
Requirement Service (Bestellungen) über Service Account oder Ereignisse.

---

## Audit Service

**Meilenstein:** M8 · **Stand:** offen – Schreibpfad jedoch ab M1 aktiv

### Verantwortung

Änderungsverfolgung, Entscheidungen, Freigaben, Compliance-Nachweise. Zentrale,
service-übergreifende Auswertung der Auditspur.

### Datenhoheit

Datenbank `audit`, Rolle `audit`.

### Wichtige Besonderheit

**Auditierung beginnt in M1, nicht in M8.** §16 verlangt sie ab der ersten
Schreiboperation. Bis zur Herauslösung schreibt jeder Service seine Audit-Ereignisse nach
einem **einheitlichen, ab M1 festgelegten Schema** in die eigene Datenbank. Die spätere
Herauslösung ist dadurch ein Umzug von Daten und Schreibpfad, keine nachträgliche
Erfindung des Konzepts.

Ein Audit-Ereignis enthält mindestens: Zeitpunkt, auslösende Identität (Benutzer **oder**
Service Account), betroffenes Objekt, Aktion, alter Wert, neuer Wert, Herkunft
(Oberfläche, API-Client, Service Account).

---

## Zuordnungshilfe

Wenn unklar ist, wohin eine Fachlichkeit gehört:

| Frage | Service |
|---|---|
| Beschreibt es, *was jemand möchte*? | Requirement |
| Beschreibt es, *wer etwas darf*? | Identity & Access |
| Beschreibt es, *was physisch oder logisch vorhanden ist*? | Infrastructure |
| Beschreibt es, *wie viel verbraucht wird oder werden wird*? | Capacity |
| Beschreibt es, *was wann von wem geändert wurde*? | Audit |

Lässt sich eine Fachlichkeit nicht eindeutig zuordnen, ist das ein Hinweis darauf, dass
sie noch nicht ausreichend verstanden ist – nicht darauf, dass ein neuer Service nötig
ist.
