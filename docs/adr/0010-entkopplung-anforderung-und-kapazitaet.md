# ADR-0010: Entkopplung von Anforderungsaufnahme und Kapazitätsberechnung

- **Status:** Angenommen
- **Datum:** 2026-08-05
- **Betrifft:** CLAUDE.md §2, §4, §7, §9, §12, §17, §18
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Fachliche Vorgabe vom 2026-08-05:

> Die Requirement-Aufnahme und die Kapazitätsberechnung müssen unabhängig erfolgen. Ziel
> ist es, beides austauschbar zu halten und über Schnittstellen oder Dateiuploads die
> Daten zur Verfügung zu stellen.

Das geht über das Prinzip der losen Kopplung aus §2 hinaus. Gefordert ist, dass **jede der
beiden Seiten durch ein Fremdsystem ersetzt werden kann**:

- Die Kapazitätsberechnung muss mit Anforderungs- und Bestelldaten arbeiten können, die
  nicht aus unserem Requirement Service stammen.
- Die Anforderungsaufnahme muss vollständig funktionieren, ohne dass eine
  Kapazitätsberechnung vorhanden ist.

Bislang beschreibt [services.md](../architecture/services.md) die Beziehung als
Service-zu-Service-Aufruf über einen Service Account. Das ist zu eng: Ein solcher Aufruf
setzt voraus, dass das Gegenüber unsere Implementierung ist.

## Entscheidung

**1. Die Grenze ist ein Integrationsvertrag, kein interner Aufruf.**
Sie wird wie eine öffentliche Schnittstelle nach §12 behandelt: versioniert,
OpenAPI-dokumentiert, mit Breaking-Change-Prüfung
([ADR-0005](0005-api-first-workflow.md)). Eine Änderung daran ist eine
Kompatibilitätsfrage, keine interne Umstrukturierung.

**2. Zwei gleichwertige Eingangswege, ein Verarbeitungspfad.**
Daten erreichen die Kapazitätsberechnung über die API **oder** über einen Dateiimport
(CSV, JSON). Beide Wege durchlaufen **dieselbe Validierung und dieselbe
Verarbeitung** – der Dateiimport ist eine andere Transportform desselben Vorgangs, keine
zweite Implementierung.

**3. Keine gemeinsamen Bezeichner über die Grenze.**
Die Kapazitätsberechnung kennt eine Bestellung ausschließlich über
`(source_system, external_id)` und den fachlichen Nutzdatensatz. Keine Fremdschlüssel auf
Tabellen des Gegenübers, keine Annahmen über dessen Bezeichnerformat.

**4. Eigenes, stabiles Statusvokabular im Vertrag.**
Die Workflow-Zustände aus §7 sind konfigurierbare Fachdaten und können sich ohne Redeploy
ändern. Sie taugen deshalb **nicht** als Vertragsbestandteil. Der Integrationsvertrag
definiert ein eigenes, kleines und stabiles Vokabular; die konfigurierbaren Zustände
werden darauf abgebildet.

**5. Keine synchrone Abhängigkeit in der Kernfunktion.**
Weder blockiert die Anforderungsaufnahme auf eine Kapazitätsantwort, noch setzt die
Berechnung eine erreichbare Anforderungsverwaltung voraus.

**6. Idempotenz ist Vertragsbestandteil.**
Dieselbe `(source_system, external_id)` mehrfach zu übermitteln erzeugt keine Dubletten.
Das ist bei Dateiimporten keine Feinheit, sondern der Normalfall: Dateien werden
wiederholt eingespielt.

## Begründung

**Austauschbarkeit ist eine Eigenschaft des Vertrags, nicht des Codes.** Solange die
Kapazitätsberechnung über unsere internen Bezeichner, Statuswerte und Tabellenstrukturen
an die Anforderungsaufnahme gebunden ist, ist sie nicht ersetzbar – unabhängig davon, wie
sauber die Module getrennt sind.

**Der Dateiimport ist kein Nebenweg.** Wird er als „Import-Skript" nachgereicht,
entstehen zwei Validierungen, die auseinanderlaufen – und die Datei-Variante ist
erfahrungsgemäß die schwächere. Da beide Wege dieselben fachlichen Daten liefern, müssen
sie denselben Pfad nehmen.

**Punkt 4 ist der am leichtesten zu übersehende.** §7 macht Statuswerte ausdrücklich
konfigurierbar. Ein Vertrag, der sie durchreicht, wäre bei der ersten
Workflow-Anpassung gebrochen – ohne dass jemand eine Schnittstelle angefasst hätte.

## Betrachtete Alternativen

### Service-zu-Service-Aufruf mit Service Account, wie bisher beschrieben

Einfacher, und §4 sieht Service Accounts ohnehin vor.

Nicht ausreichend: Ein direkter Aufruf setzt voraus, dass das Gegenüber unsere API
spricht und unsere Bezeichner führt. Genau das schließt die Vorgabe aus. Service Accounts
bleiben das Mittel der Authentifizierung – aber der **Inhalt** des Aufrufs ist ein
Integrationsvertrag, kein internes Datenmodell.

### Gemeinsame Datenbank oder gemeinsames Schema

Am einfachsten umzusetzen.

Nicht gewählt: widerspricht §4 und [ADR-0003](0003-datenbank-und-datenhoheit.md) und macht
Austauschbarkeit unmöglich.

### Ereignisgetriebene Kopplung ohne Dateiweg

Gut für Entkopplung zur Laufzeit.

Nicht ausreichend: Ein Fremdsystem, das nur Dateien liefern kann, bliebe außen vor. Die
Vorgabe nennt Dateiuploads ausdrücklich als gleichwertigen Weg. Ereignisse bleiben als
zusätzlicher Transport möglich.

## Konsequenzen

### Positiv

- Jede Seite ist durch ein Fremdsystem ersetzbar, ohne die andere anzufassen.
- Ein Fremdsystem ohne API-Fähigkeit kann über Dateien angebunden werden.
- Der Vertrag ist prüfbar und versioniert statt implizit.

### Negativ und Risiken

- **Zusätzliche Abbildungsschicht.** Interne Zustände müssen auf das Vertragsvokabular
  abgebildet werden. Mehr Code – dafür bricht eine Workflow-Änderung keine Schnittstelle.
- **Kein referenzieller Schutz über die Grenze.** Ohne Fremdschlüssel kann die
  Kapazitätsberechnung Daten zu einer Bestellung führen, die es beim Gegenüber nicht mehr
  gibt. Das ist der Preis der Austauschbarkeit und braucht einen Abgleichmechanismus.
- **Idempotenz muss durchgesetzt werden**, nicht nur zugesichert – über eine Eindeutigkeit
  auf `(source_system, external_id)`.
- **Der Vertrag wird zum Engpass.** Änderungen daran sind teurer als an internen APIs.
  Beabsichtigt: Genau das macht ihn verlässlich.

## Sofortige Auswirkung auf das Datenmodell

Die Kernentität `requirement` erhält **vor der ersten Schreiboperation** zwei Felder:

| Feld | Zweck |
|---|---|
| `source_system` | Herkunft des Datensatzes; für eigene Erfassung ein fester Wert |
| `external_id` | Bezeichner im Herkunftssystem; bei eigener Erfassung die eigene Kennung |

Dazu eine Eindeutigkeit über beide Felder gemeinsam (Punkt 6).

Diese Ergänzung jetzt vorzunehmen kostet eine Migration ohne Daten. Später kostet sie eine
Migration mit Daten, für die es keine Herkunftsangabe gibt – und die Frage, welcher Wert
rückwirkend richtig ist, lässt sich dann nicht mehr beantworten.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Statusvokabular des Vertrags und Abbildungsregeln | M4, mit der Workflow-Engine |
| Format und Schema des Dateiimports (CSV, JSON) | M7, mit dem Capacity Service |
| Abgleichmechanismus für verwaiste Datensätze | M7 |
| Ereignisse als zusätzlicher Transportweg | sobald Messaging eingeführt wird |
| Ob der Vertrag ein eigenes Paket unter `packages/` wird | M7 |
