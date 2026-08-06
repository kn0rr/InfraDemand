# ADR-0012: Vollständige Versionierung mit Zeitbezug

- **Status:** Angenommen
- **Datum:** 2026-08-05
- **Betrifft:** CLAUDE.md §2, §6, §9, §10, §11, §16, §18
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Fachliche Vorgabe vom 2026-08-05:

> Jede Änderung der Daten soll versioniert werden. Gegebenenfalls möchte ich auch in
> Grafen ausweisen, wie sich Anforderungen über die Zeit verändert haben, um
> nachzuweisen, dass man im Kapazitätsmanagement richtig reagiert hatte zum damaligen
> Zeitpunkt.

Der zweite Satz ist der entscheidende. „Richtig reagiert **zum damaligen Zeitpunkt**"
bedeutet, dass nicht die heutige Sicht auf die Vergangenheit gefragt ist, sondern die
damalige:

> Welchen Anforderungsbestand kannte das System am 15. März – mit den damaligen Mengen,
> Status und Attributen, ohne spätere Korrekturen?

Das ist eine andere Anforderung als „Änderungen protokollieren". Ein Protokoll belegt,
*dass* etwas geändert wurde. Gefordert ist, den **vollständigen Zustand zu einem
beliebigen vergangenen Zeitpunkt abzufragen** – und zwar auswertbar, weil daraus Grafen
und Auswertungen entstehen sollen (§10, §11).

## Entscheidung

**1. Jede Änderung fachlicher Daten erzeugt eine neue Version.**
Der vollständige Zeilenzustand wird versioniert, nicht nur die geänderten Felder.

**2. Umgesetzt als Historientabelle je Entität**, geschrieben in **derselben Transaktion**
wie die fachliche Änderung. Die Fachtabelle führt weiterhin ausschließlich den aktuellen
Zustand; die Historie liegt daneben.

**3. Zeitbezug ist zunächst die Erfassungszeit** (Transaktionszeit): der Zeitraum, in dem
das System einen Wert für gültig hielt. Abgebildet über `valid_from` und `valid_to`.

**4. Abfragen zu einem Stichtag sind eine erstklassige Fähigkeit**, keine Auswertung im
Nachgang. Der Zustand zum Zeitpunkt `T` ist eine gewöhnliche, indizierbare Abfrage.

**5. Die Historie ist zugleich der Auditpfad.** Es entstehen **nicht** zwei Mechanismen.
Was §16 verlangt – alter Wert, neuer Wert, Herkunft – ergibt sich aus dem Vergleich
aufeinanderfolgender Versionen.

**6. Löschungen sind fachlich, nicht physisch.** Ein physisch entfernter Datensatz
zerstört die Rekonstruierbarkeit. Der Löschvorgang erzeugt eine Version mit
entsprechender Kennzeichnung.

**7. Die Gültigkeitszeit wird vertagt, aber nicht ausgeschlossen.** Rückwirkende
Korrekturen – „der Bedarf war schon immer 100, wir hatten irrtümlich 80 erfasst" –
erfordern eine zweite Zeitachse. Das Modell wird so geschnitten, dass sie ergänzbar
bleibt.

## Begründung

**Warum eine Historientabelle und kein Ereignisprotokoll.** Event Sourcing könnte
dasselbe leisten, verlangt aber, jeden Lesezugriff über eine Projektion zu führen und
jede Auswertung aus Ereignissen aufzubauen. Für §10 und §11 werden Aggregationen über
Zustände zu Stichtagen gebraucht – mit einer Historientabelle ist das gewöhnliches SQL
mit Index, mit Ereignissen ein eigener Projektionsapparat. Die Anforderung rechtfertigt
den Aufwand nicht.

**Warum vollständige Zeilen statt einzelner Feldänderungen.** Feldgenaue Einträge
erzeugen bei jeder Rekonstruktion eines Stichtagszustands eine Zusammensetzung aus vielen
Zeilen – aufwendig und fehleranfällig, genau in dem Zugriffsmuster, das die Anforderung
verlangt. Vollständige Versionen kosten Speicherplatz und liefern den Stichtagszustand
mit einer einzigen Bedingung.

**Warum die Historie den Auditpfad ersetzt und nicht ergänzt.** Zwei Mechanismen für
denselben Zweck laufen auseinander, und der weniger genutzte ist der unzuverlässigere.
Der Vergleich zweier aufeinanderfolgender Versionen liefert alter Wert, neuer Wert und –
da jede Version genau eine Quelle hat – auch die feldgenaue Herkunft aus
[ADR-0011](0011-datenhoheit-je-feld-und-kontext.md). Damit ist deren Punkt 4 erfüllt,
ohne einen zweiten Speicher.

**Warum die Fachtabelle den aktuellen Zustand behält.** Alle Versionen in einer Tabelle
zu führen wäre kompakter, macht aber jeden gewöhnlichen Lesezugriff zu einer
Zeitraumabfrage und jede Eindeutigkeitsbedingung zum Sonderfall. Der häufigste Zugriff –
„aktueller Bestand" – bleibt so einfach und schnell.

## Betrachtete Alternativen

### Nur ein Änderungsprotokoll, Zustand bei Bedarf nachbilden

Wenig Speicherbedarf, einfache Schreiblogik.

Nicht gewählt: Für einen Stichtagszustand müssten alle Änderungen seit Anlage nachgespielt
werden – je Datensatz, je Auswertung. Für Grafen über den Zeitverlauf, die viele
Stichtage über viele Datensätze verbinden, ist das nicht tragfähig.

### Systemversionierte Tabellen über eine PostgreSQL-Erweiterung

Nahe am Standard SQL:2011, die Versionierung erfolgt automatisch per Trigger.

Nicht gewählt: zusätzliche Betriebsabhängigkeit, und die Automatik verlagert die
Historisierung in die Datenbank, wo sie für die Anwendung unsichtbar wird. Das
widerspricht derselben Überlegung, aus der in
[ADR-0009](0009-orm-und-migrationswerkzeug.md) der Auditpfad ausdrücklich geschrieben
wird: Ein Nachweis, der als Nebeneffekt entsteht, fällt still aus.

### Event Sourcing

Siehe Begründung. Bleibt für den Capacity Service (§9) offen, wo Zeitreihen ohnehin das
tragende Muster sind.

## Konsequenzen

### Positiv

- Der Zustand zu jedem vergangenen Zeitpunkt ist mit gewöhnlichem SQL abfragbar – die
  Voraussetzung für die geforderten Grafen (§11) und für §10.
- §16 ist ohne zweiten Mechanismus erfüllt.
- Die feldgenaue Herkunft aus ADR-0011 ergibt sich durch Vergleich, ohne eigenen Speicher.
- Der Nachweis „so war die Lage damals" ist belegbar statt behauptet.

### Negativ und Risiken

- **Speicherwachstum.** Jede Änderung erzeugt eine vollständige Zeilenkopie. Bei breiten
  Zeilen mit großem JSONB-Anteil (§6) ist das erheblich. Braucht ein
  Aufbewahrungskonzept – siehe PROD-020.
- **Jede Schreiboperation wird teurer**: zwei Schreibvorgänge in einer Transaktion.
- **Zielkonflikt mit Löschpflichten.** Punkt 6 steht der DSGVO-Löschung entgegen. Die
  Auflösung – etwa Anonymisierung personenbezogener Felder in der Historie unter Erhalt
  der fachlichen Mengen – ist in PROD-020 zu klären und **nicht** nebenbei zu entscheiden.
- **Rückwirkende Korrekturen sind ohne Gültigkeitszeit nicht sauber abbildbar.** Sie
  erscheinen als Änderung zum Korrekturzeitpunkt, nicht als Richtigstellung der
  Vergangenheit. Für den beabsichtigten Nachweis ist das sogar das gewünschte Verhalten;
  für fachliche Auswertungen kann es irreführend sein. Punkt 7 hält den Weg offen.
- **Migrationen müssen die Historie mitführen.** Eine Schemaänderung an der Fachtabelle
  betrifft auch die Historientabelle – sonst passen alte Versionen nicht mehr zum
  Auslesecode.

## Auswirkung auf M1.4

Die Historientabelle entsteht **zusammen mit der ersten Schreiboperation**, nicht danach.
Erforderliche Felder zusätzlich zum fachlichen Zeilenzustand:

| Feld | Zweck |
|---|---|
| `version` | fortlaufende Versionsnummer je Datensatz |
| `valid_from` | Beginn des Zeitraums, in dem diese Version galt |
| `valid_to` | Ende; für die aktuelle Version leer |
| `operation` | Anlage, Änderung, Löschung |
| `changed_by` | auslösende Identität (Benutzer oder Service Account) |
| `source_system` | Herkunft nach [ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md) |

Index auf `(id, valid_from)` – das ist der Zugriffspfad jeder Stichtagsabfrage.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Historientabelle und Schreibpfad für `requirement` | **M1.4** |
| Gültigkeitszeit als zweite Zeitachse | wenn rückwirkende Korrekturen fachlich auftreten |
| Aufbewahrungsfristen und Verdichtung alter Versionen | mit PROD-020 |
| Auflösung des Zielkonflikts Löschpflicht gegen Nachweispflicht | mit PROD-020, vor Produktivgang |
| Stichtagsabfragen im Lesemodell für Reporting | M8 |
| Gleiches Verfahren im Capacity Service, oder dort Zeitreihen | M7 |
