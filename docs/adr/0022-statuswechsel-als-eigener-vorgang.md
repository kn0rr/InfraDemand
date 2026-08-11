# ADR-0022: Statuswechsel als eigener Vorgang und Pflicht zum Workflow

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §7, §16, §19.1, §19.2
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Mit M4.1 gibt es Workflow-Definitionen als versionierte Fachdaten: Zustände, Übergänge,
Anfangszustand, Betriebsart. Der Graph wird beim Speichern auf Widersprüche geprüft.

**Durchgesetzt wird davon nichts.** `requirement.status` ist eine freie Zeichenkette, die
über `POST /v1/requirements` und `PATCH /v1/requirements/by-source/…` auf jeden beliebigen
Wert gesetzt werden kann – auch auf einen, den kein Graph kennt. Der Workflow beschreibt,
er entscheidet nicht (`PROD-052`).

§7 verlangt das Gegenteil: Jeder Statuswechsel läuft gegen den Zustandsgraphen, Übergänge
können Berechtigungen und Pflichtfelder erzwingen, jeder Wechsel wird historisiert. Der
Schritt dorthin ist die erste **inkompatible Änderung mit echter Verhaltensänderung** –
anders als die Contract-Korrekturen aus M3 verhält sich der Dienst danach tatsächlich
anders.

Drei Fragen mussten davor beantwortet werden.

### Die erste Frage war zunächst falsch gestellt

Sie lautete: *Wie werden vorhandene `status`-Werte auf Zustandsschlüssel abgebildet?* Als
Datenmigration ist sie gegenstandslos – die Plattform lief nie außerhalb der
Entwicklungsumgebung, und ein Migrationsschritt hätte nichts zu migrieren.

Der Fall verschwindet damit nicht, er wird dauerhaft:

| Wie ein Zustand entsteht, den der Graph nicht kennt | einmalig |
|---|---|
| Die Anforderung entstand, bevor es für ihren Typ einen Workflow gab | nein |
| Ein Import liefert einen Status aus einem Fremdsystem (§19.2) | nein |
| Ein Administrator entfernt einen Zustand aus einer Definition | durch M4.4 gemildert |

Eine Migration hätte den ersten Fall gelöst und die anderen beiden offen gelassen. Zu
entscheiden ist deshalb das **Laufzeitverhalten**, nicht ein Migrationsschritt.

### Die zweite Frage

Was bedeutet ein Anforderungstyp, für den kein gültiger Workflow existiert? Der allgemeine
Workflow (`requirement_type IS NULL`) fängt alle Typen ohne eigenen ab; „kein Workflow"
heißt also: Es gibt nicht einmal einen allgemeinen, oder er ist außer Kraft gesetzt.

### Die dritte Frage

§19.2 verlangt **drei gleichrangige Eingangswege** – Schnittstelle, Dateiupload, manuelle
Erfassung – durch **denselben Verarbeitungspfad**. Wird der Statuswechsel ein Vorgang, der
einen Übergang verlangt, entsteht ein Bruch: Ein Fremdsystem liefert einen Zielzustand,
keinen Übergang. Es kennt unseren Graphen nicht.

## Entscheidung

**1. Der Statuswechsel wird ein eigener Vorgang.**
`status` verlässt den allgemeinen Schreibpfad. Weder das Anlegen noch das Ändern einer
Anforderung setzt ihn. Ein Wechsel benennt einen Übergang des geltenden Graphen.

**2. Jede Anforderung hat jederzeit einen Workflow.**
Existiert für ihren Anforderungstyp kein gültiger Workflow – weder ein typbezogener noch
ein allgemeiner –, entsteht die Anforderung nicht. Das Anlegen wird abgewiesen.

**3. Der Anfangszustand kommt aus der Workflow-Definition.**
`status` entfällt in `CreateRequirementDto`. Aus Punkt 2 folgt, dass es beim Anlegen immer
einen Graphen gibt, und der trägt seinen `initialState`.

**4. Außer Kraft gesetzt heißt „keiner", nicht „der allgemeine".**
Ein deaktivierter typbezogener Workflow fällt **nicht** auf den allgemeinen zurück. Die
Anforderungen dieses Typs liefen sonst ab dem Moment durch einen anderen Graphen, ohne
dass es jemand angeordnet hätte.

**5. Ein unbekannter Ausgangszustand wird benannt, nicht überschrieben.**
Trifft ein Wechsel auf eine Anforderung, deren aktueller Zustand im geltenden Graphen
nicht vorkommt, wird er abgewiesen – mit dem konkreten Grund, nicht mit „Übergang
unzulässig". Lesen bleibt möglich.

Für die Auflösung gibt es einen eigenen Verwaltungsvorgang **„Zustand zuordnen"**: Er
setzt die Anforderung auf einen Zustand des Graphen, verlangt eine Begründung und erzeugt
eine reguläre Version. Er ist kein Übergang und wird als solcher auch nicht ausgewiesen.

**6. Bei eigengeführten Workflows ermittelt der Aufrufer den Übergang nicht – der Dienst
tut es.**
Ein Import nennt den Zielzustand. Aus aktuellem und gewünschtem Zustand ergibt sich der
Übergang eindeutig: Doppelte Übergänge zwischen demselben Zustandspaar sind seit M4.1
ausgeschlossen, es gibt also höchstens einen. Gibt es keinen, wird abgewiesen –
verarbeitet nach [ADR-0019](0019-verhalten-bei-abgewiesener-schreiboperation.md), also bei
automatischer Herkunft festgehalten statt zurückgemeldet.

Damit läuft der Import durch **dieselbe** Prüfung wie die Oberfläche. §19.2 ist gewahrt.

**7. Bei fremdgeführten Workflows wird der Zielzustand entgegengenommen.**
Ist die Betriebsart `external`, führt das Fremdsystem den Vorgang
([ADR-0021](0021-anbindung-externer-workflows.md) Punkt 4). Ein Zielzustand von dort ist
eine **Mitteilung, keine Bitte**. Geprüft wird nur, dass der Zustand im Graphen vorkommt.

**8. `status` bleibt hoheitsfähig.**
Die Hoheitsregeln nach [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md)
gelten für den Statuswechsel weiter. Sie regeln, **wer** einen Zustand setzen darf; der
Graph regelt, **wohin**. Die beiden Prüfungen ersetzen einander nicht.

**9. Umfang.** M4.2 setzt die Punkte 1 bis 8 um. Bedingungen an Übergängen – Pflichtfelder,
benötigte Berechtigung – folgen mit M4.3, die Bindung laufender Anforderungen an ihre
Workflow-Fassung mit M4.4.

## Begründung

**Zu 1 – warum `status` den allgemeinen Schreibpfad verlassen muss.** Solange der Zustand
ein gewöhnliches Feld ist, gibt es nichts zu prüfen: Ein `PATCH`, das `status` mitschickt,
ist von einem, das `owner` ändert, nicht zu unterscheiden. Jede Prüfung, die man auf dem
allgemeinen Pfad ergänzt, ist eine Sonderbehandlung eines Feldnamens – und die nächste
Stelle, die schreibend zugreift, kennt sie nicht.

**Zu 2 – warum die Pflicht und nicht nur eine Sperre für Wechsel.** Die schwächere Variante
– ohne Workflow ist kein *Wechsel* erlaubt, das Anlegen aber schon – lässt Anforderungen
ohne Graphen entstehen. Dann muss `status` beim Anlegen gesetzt werden, weil es keinen
`initialState` gibt, aus dem er kommen könnte. Genau der Weg bliebe offen, den Punkt 1
schließen soll.

Entscheidend ist die Fehlerart. „Nicht konfiguriert" darf nicht „nicht kontrolliert"
bedeuten: Wer einen neuen Anforderungstyp einführt und den Workflow vergisst, bekäme sonst
einen Typ ohne jede Steuerung, der in der Oberfläche genauso aussieht wie ein gesteuerter.
Mit der Pflicht scheitert er sofort und sichtbar.

**Zu 5 – warum benennen und nicht zurücksetzen.** Eine Anforderung, die „freigegeben" war,
auf den Anfangszustand zu setzen, schreibt Geschichte um – und zwar lautlos, mitten in
einem Vorgang, der nach einer gewöhnlichen Statusänderung aussieht. Der Nachweiszweck aus
[ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) wäre dahin.

Die Alternative, das Schlüsselformat zu lockern, damit alte Werte gültige Schlüssel wären,
löst nichts: Das Problem ist nicht das Zeichenformat, sondern dass der Wert im Graphen
nicht vorkommt. Ein anderes Format macht es möglich, den Zustand *so zu benennen* –
anlegen muss ihn trotzdem jemand.

**Zu 6 und 7 – warum die Betriebsart entscheidet.** Der naheliegende Ausweg wäre, Importe
den Status direkt schreiben zu lassen. §19.2 sagt ausdrücklich, warum das nicht geht:

> Zwei Validierungswege laufen auseinander, und der seltener genutzte ist der schwächere.

Die Unterscheidung nach Betriebsart ist dagegen kein Sonderweg, sondern die bereits in
ADR-0021 getroffene Entscheidung, angewandt auf den Schreibpfad. Bei `external` führt das
Fremdsystem; ihm einen Übergang abzuverlangen, den es nicht kennt, hieße, unsere Sicht zur
maßgeblichen zu erklären – und bei einem Widerspruch wäre unsere die falsche.

**Zu 6 – warum die Suche eindeutig ist.** Sie ist es, weil M4.1 doppelte Übergänge
zwischen demselben Zustandspaar abweist. Diese Prüfung war als Sauberkeitsregel gedacht;
sie trägt hier eine Zusicherung. Ohne sie müsste der Import zwischen mehreren Übergängen
wählen – und die Wahl wäre willkürlich, sobald M4.3 unterschiedliche Bedingungen an sie
knüpft.

## Betrachtete Alternativen

### Unbekannten Zustand auf den Anfangszustand zurücksetzen

Kein Sonderfall, keine zusätzliche Oberfläche, keine feststeckenden Anforderungen.

**Nicht gewählt.** Der Vorgang sähe aus wie eine gewöhnliche Statusänderung und wäre in
Wahrheit eine Rücksetzung. Fällt niemandem auf, und danach behauptet die Historie etwas
Falsches über einen Zeitpunkt, für den sie als Nachweis dienen soll.

### Zustandsschlüssel lockern

Erlaubt beliebige Zeichenketten als Zustandsschlüssel, damit vorhandene `status`-Werte
gültig wären.

**Nicht gewählt.** Löst das Problem nicht (siehe Begründung zu 5) und kostet das stabile
Schlüsselformat, auf das Oberfläche und spätere Abbildung auf das Statusvokabular des
Vertrags (ADR-0010) sich stützen.

### Ohne Workflow ist jeder Wechsel erlaubt

Verträglich mit dem heutigen Verhalten; bei M4.2 bricht nichts.

**Nicht gewählt.** Macht `PROD-052` zum Dauerzustand: Ein nicht konfigurierter Typ ist
ungesteuert und von einem gesteuerten nicht zu unterscheiden.

### Ohne Workflow ist nur der Wechsel gesperrt, das Anlegen erlaubt

Weniger einschneidend, kein Stillstand bei fehlender Konfiguration.

**Nicht gewählt**, weil `status` dann beim Anlegen bestehen bleiben muss – siehe Begründung
zu 2.

### Importe schreiben den Status direkt

Einfach, keine Übergangssuche, kein Sonderfall für unbekannte Zustände beim Import.

**Nicht gewählt.** Zweiter Validierungsweg, ausdrücklich durch §19.2 ausgeschlossen. Der
Dateiimport ist eine Transportform desselben Vorgangs, keine zweite Implementierung.

## Konsequenzen

### Positiv

- §7 ist erfüllt: Jeder Wechsel läuft gegen den Graphen, `PROD-052` wird geschlossen
- Jede Anforderung hat zu jedem Zeitpunkt einen Graphen – eine Zusicherung, auf die M4.3
  (Bedingungen) und M4.4 (Fassungsbindung) aufbauen können, ohne einen Sonderfall zu führen
- Der Anfangszustand ist Fachdatum statt Eingabe. Damit verschwindet die letzte Stelle, an
  der ein Zustand ohne Bezug zum Workflow entstehen konnte
- Alle drei Eingangswege nach §19.2 laufen durch dieselbe Prüfung
- Die Betriebsart aus M4.1 bekommt ihre erste Wirkung; sie war bis hierher eine Spalte ohne
  Verhalten

### Negativ und Risiken

- **Inkompatible Änderung am Contract.** `status` entfällt im Anlegerumpf, `PATCH` weist
  ihn ab. Der erste Bruch mit echter Verhaltensänderung; `oasdiff` wird ihn melden, und die
  Entscheidung dazu gehört sichtbar in die PR-Geschichte
- **Wer den allgemeinen Workflow außer Kraft setzt, legt den Dienst für alle Typen ohne
  eigenen stumm.** Ein Datensatz, große Wirkung. Bewusst in Kauf genommen: Der Fehler tritt
  sofort auf, betrifft den, der ihn verursacht hat, und ist durch Umlegen desselben
  Schalters behoben. Die Verwaltungsoberfläche weist beim Deaktivieren darauf hin
- **Anforderungen können feststecken**, bis jemand „Zustand zuordnen" ausführt. Das ist der
  Preis dafür, nichts stillschweigend zu überschreiben – und Feststecken ist sichtbar
- **Ein Import, dessen Zielzustand nicht erreichbar ist, verliert den Statuswechsel
  stillschweigend**, weil ADR-0019 automatische Abweisungen festhält statt zurückzumelden.
  Das Vorsystem führt die Anforderung dann als fortgeschritten, während sie hier steht.
  Sichtbar wird es nur, wenn jemand die Abweisungen ansieht – neu als `PROD-053` geführt,
  weil diese Entscheidung den möglichen Schaden von einzelnen Feldwerten auf Statuswechsel
  ausweitet
- **Das Ändern des Anfangszustands wirkt nicht rückwirkend**, aber unterschiedlich alte
  Anforderungen desselben Typs können in verschiedenen Zuständen begonnen haben. Für die
  Auswertung nach §10 ist das zu berücksichtigen

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Bedingungen an Übergängen; damit die seit ADR-0001 vertagte Wahl der Regel-Engine | M4.3 |
| Bindung laufender Anforderungen an ihre Workflow-Fassung | M4.4 |
| Braucht „Zustand zuordnen" ein eigenes Recht, oder genügt `platform-admin`? | M4.2 |
| Abbildung der Workflow-Zustände auf das stabile Statusvokabular des Vertrags (ADR-0010) | wenn der Capacity Service angebunden wird |
| Verhalten, wenn ein Endzustand erreicht ist – ist die Anforderung damit abgeschlossen, oder ist „abgeschlossen" ein eigenes Merkmal? | M4.3 |
