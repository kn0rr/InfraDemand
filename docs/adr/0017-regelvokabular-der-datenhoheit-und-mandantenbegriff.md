# ADR-0017: Regelvokabular der Datenhoheit und Begriff des Mandanten

- **Status:** Angenommen
- **Datum:** 2026-08-06
- **Betrifft:** CLAUDE.md §6, §8, §15, §16, §19.2, §19.3
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0011](0011-datenhoheit-je-feld-und-kontext.md) lässt zwei Fragen offen: das
**Regelvokabular** der Datenhoheit (vorgesehen für M3) und die Bedeutung von **„Kontext"**
(zu klären vor M3). [ADR-0015](0015-mehrere-identitaetsquellen.md) lässt eine dritte
offen: was ein **Mandant** ist.

Die drei hängen zusammen, und zwar in einer Reihenfolge, die zunächst nicht sichtbar war:
**Wie eine Regel formuliert wird, entscheidet darüber, ob es überhaupt einen
Geltungsbereich braucht.**

Das Problem, das gelöst werden muss, ist unabhängig davon dasselbe. §6 und §16 beantworten
je Feld die Frage *„darf diese Quelle schreiben?"*. Sie beantworten nicht *„wer gewinnt,
wenn zwei Quellen schreiben?"* – und der Vorgabewert lautet „Überschreiben ist erlaubt".
Praktisch heißt das: der Letzte gewinnt.

```
Di 02:00   Import aus dem Vorsystem   owner = "M. Weber"
Di 09:15   Erfassung im Frontend      owner = "T. Schmidt"
Mi 02:00   Import aus dem Vorsystem   owner = "M. Weber"
```

Niemand handelt regelwidrig; jede einzelne Schreiboperation war erlaubt. Die Änderung aus
dem Frontend ist trotzdem jede Nacht wieder fort, und derjenige, der sie vorgenommen hat,
erfährt es erst, wenn eine Entscheidung an der falschen Person hängt.

### Die entscheidende Unterscheidung

Eine Hoheitsregel lässt sich auf zwei Arten formulieren:

| Formulierung | Beispiel | Folge |
|---|---|---|
| **absolut** – benennt ein konkretes System | „für `owner` ist SAP führend" | Systemnamen sind je Mandant verschieden. Die Regel gilt nur dort, wo dieses System existiert – sie braucht zwingend einen Geltungsbereich |
| **relativ** – benennt eine Klasse von Quellen | „für `owner` hat der automatische Ladevorgang Vorrang" | Die Regel greift nur, wo eine automatische Quelle das Feld tatsächlich bespielt. Wo keine existiert, wirkt sie nicht – ein Geltungsbereich wird nicht gebraucht |

Am selben Beispiel, mit der relativen Formulierung und **einer** Regel:

```
Regel:  owner → automatischer Ladevorgang hat Vorrang

Mandant A, Bestellung   Vorsystem schreibt, manuelle Änderung abgewiesen    beabsichtigt
Mandant A, Feature      nichts lädt automatisch → manuelle Pflege greift    beabsichtigt
Mandant B, alles        kein Vorsystem vorhanden → manuelle Pflege greift   beabsichtigt
```

Drei verschiedene Wirkungen, ohne Fallunterscheidung in der Konfiguration.

## Entscheidung

### Teil A – Regelvokabular

**A1. Die Hoheitsregel gilt je Feld und benennt eine Quellenklasse, kein konkretes
System.**

**A2. Es gibt genau drei Werte.**

| Wert | Wirkung |
|---|---|
| `manuell erlaubt` | Jede berechtigte Quelle schreibt, die letzte gewinnt |
| `Automatik hat Vorrang` | Manuelle Änderung wird abgewiesen, **solange eine automatische Quelle das Feld bespielt** |
| `manuell gesperrt` | Manuelle Änderung wird **immer** abgewiesen, auch ohne automatische Quelle |

**A3. Der Vorgabewert ist `manuell erlaubt`** und entspricht damit dem globalen
Vorgabewert aus §6 und §16. Ohne gepflegte Regel ändert sich gegenüber heute nichts.

**A4. Die Quellenklasse folgt aus der Herkunftsangabe, nicht aus dem Transportweg.**
Herkunftssysteme sind Stammdaten und tragen das Merkmal *automatisch* oder *manuell*. Ein
Dateiupload mit der Herkunft eines Vorsystems ist damit automatisch; ein Upload ohne
Herkunftssystem ist manuelle Masseneingabe. Das setzt §19.2 um, wonach sich die drei
Eingangswege ausschließlich in Transport und Herkunftsangabe unterscheiden.

**A5. Es gibt keine Kontextdimension.** Eine Regel gilt für alle Anforderungen. Die in
ADR-0011 offene Frage nach dem Kontext wird damit beantwortet – mit *keiner*, nicht mit
einer bestimmten.

**A6. Vorkehrung: Die Regel trägt von Beginn an eine Bindungsspalte, die leer bleibt.**
Kein Code setzt voraus, dass sie leer ist. Wird später ein Geltungsbereich gebraucht, ist
das ein Datensatz und keine Migration – dieselbe Vorkehrung wie
[ADR-0015](0015-mehrere-identitaetsquellen.md) Punkt 3 für die Zahl der Aussteller.

**A7. Die Regeln sind Fachdaten**, über die Administrationsoberfläche gepflegt,
versioniert, ohne Redeploy änderbar. Das bestätigt ADR-0011 Punkt 3.

### Teil B – Ausnahmen vom Regelwerk

Teil A regelt, **wer schreiben darf** – einheitlich für alle Datensätze. Teil B regelt die
beiden Ausnahmen davon, die je Datensatz gelten.

#### Administrative Einzelübernahme

**B1. Ein Berechtigter kann per Upload Felder setzen, die eine Regel sonst sperrt.**

**B2. Die Ausnahme gilt je Vorgang, nicht als Zustand.** Sie wird für die eine Übernahme
ausdrücklich angefordert; danach greift die Regel unverändert weiter. Es gibt keinen
Schalter, der sie dauerhaft aufhebt.

**B3. Sie trägt eine eigene Herkunftskennung** – *administrative Korrektur* – und ist in
der Versionshistorie nach [ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) als
solche erkennbar.

**B4. Sie ist ein eigenes Recht** im Sinne von §8, nicht Bestandteil einer allgemeinen
Schreibberechtigung.

**B5. Sie repariert für sich genommen den Wert, nicht die Ursache.** Lädt die automatische
Quelle weiterhin, wäre die Korrektur beim nächsten Lauf überschrieben. Dagegen richtet sich
das Festhalten.

#### Festhalten eines Feldes

**B6. Ein Feld kann an einem einzelnen Datensatz gegen automatische Übernahme festgehalten
werden.** Solange die Festhaltung besteht, ändert kein automatischer Ladevorgang dieses
Feld an diesem Datensatz. Andere Felder desselben Datensatzes und dasselbe Feld an anderen
Datensätzen bleiben unberührt.

**B7. Die Festhaltung entsteht nur durch ausdrückliche Angabe.** Sie ist keine Folge einer
manuellen Änderung und kein Vorgabewert einer administrativen Korrektur. Wer einen Wert
festhalten will, erklärt das gesondert.

**B8. Die Festhaltung verlangt eine Begründung.** Sie erzeugt eine dauerhafte, gewollte
Abweichung vom Herkunftssystem. Wer sie Monate später vorfindet, muss erkennen können,
warum sie besteht – sonst bleibt nur, sie aufzuheben und abzuwarten, was kaputtgeht.

**B9. Die Festhaltung ist Bestandteil des versionierten Zustands**, mit Person und
Zeitpunkt. Sie ist damit über die Historie nach ADR-0012 zu jedem vergangenen Zeitpunkt
auswertbar wie jeder andere Wert.

**B10. Jede abgewiesene Schreiboperation wird verzeichnet** – mit Zeitpunkt, Herkunft, Feld
und dem abgewiesenen Wert. Das gilt für den automatischen Lauf, der auf ein festgehaltenes
Feld trifft, ebenso wie für den manuellen Versuch, den eine Regel aus A2 abweist. Die
Richtung der Abweisung ändert nichts an ihrer Nachweisbarkeit.

**B11. Diese Aufzeichnung ist keine Version.** Eine abgewiesene Schreiboperation ändert den
Datensatz nicht. Sie als Version zu führen erzeugte Versionen, die sich von ihrer
Vorgängerin nicht unterscheiden, und entwertete die Zählung, an der §19.4 hängt. Die
Aufzeichnung steht deshalb getrennt und beantwortet eine andere Frage:

| Speicher | beantwortet |
|---|---|
| Versionshistorie ([ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md)) | Wie sah unser Datensatz zum Zeitpunkt T aus? |
| Abweisungen | Was hat eine Quelle zum Zeitpunkt T geliefert, das wir nicht übernommen haben? |

Damit wird die in ADR-0012 geschlossene Frage nach zwei Mechanismen **nicht** neu
eröffnet: Dort ging es darum, dieselbe Auskunft nicht zweimal zu speichern. Hier sind es
verschiedene Auskünfte, und zusammen sind sie vollständig – eine übernommene Lieferung
steht in der Versionshistorie, eine abgewiesene hier.

**B12. Aufheben ist ein eigener, ebenso ausdrücklicher Vorgang** und unterliegt demselben
Recht wie das Festhalten.

**B13. Festgehaltene Felder sind am Datensatz sichtbar** – in der Oberfläche und über die
Schnittstelle. Eine unsichtbare Festhaltung erzeugt genau den stillen Auseinanderlauf
zwischen Plattform und Herkunftssystem, den sie verhindern soll.

**B14. Es gibt eine plattformweite Übersicht aller festgehaltenen Felder.** Sie ist
Bestandteil der Administrationsoberfläche, nicht ein Auswertungsbericht, und zeigt je
Eintrag mindestens:

| Angabe | Herkunft |
|---|---|
| Datensatz und Feld | B6 |
| festgehalten seit, durch wen | B9 |
| Begründung | B8 |
| festgehaltener Wert | Versionshistorie |
| **zuletzt abgewiesene Lieferung** – Wert, Quelle, Zeitpunkt | B10 |

Die letzte Zeile ist der eigentliche Ertrag aus B10: Die Übersicht zeigt die Abweichung
nicht nur als Zustand, sondern beziffert sie – *festgehalten „T. Schmidt", Herkunftssystem
liefert seit 47 Läufen „M. Weber"*. Erst damit ist eine Durchsicht möglich, die zu einer
Entscheidung führt statt zu einer Liste.

> **Nicht zu verwechseln mit `manuell gesperrt` aus A2.** Die beiden Sperren zeigen in
> entgegengesetzte Richtungen: `manuell gesperrt` ist eine Regel für **alle** Datensätze
> und hält **Menschen** von einem Feld fern. Die Festhaltung gilt für **einen** Datensatz
> und hält die **Automatik** fern.

### Teil C – Mandant

**C1. Der Mandant ist eine fachliche Entität der Plattform, kein Keycloak-Objekt.** Er
trägt Bezeichnung, Kostenstellen und Zuständigkeiten und wird vom Identity & Access
Service geführt (§5).

**C2. Keycloak stellt ausschließlich die Zugehörigkeit fest.** Sie erreicht die Anwendung
als Anspruch im Token; technisch bildet eine Keycloak-*Organization* darauf ab (ADR-0015
Punkt 1), ohne dass die Anwendung davon abhängt. Die Verbindung ist ein Bezeichner, sonst
nichts.

**C3. Ein Anwender kann mehreren Mandanten angehören.** ADR-0015 hat diesen Fall bereits
gegen die Auflösung über Subdomänen ins Feld geführt; er wird hier bestätigt. Der wirksame
Mandant folgt damit nicht allein aus der Identität.

**C4. Ein Realm je Mandant bleibt ausgeschlossen**, solange ADR-0015 gilt.

## Begründung

**Zu A1 – warum relativ und nicht absolut.** Die absolute Formulierung erzwingt einen
Geltungsbereich, weil sie ein System beim Namen nennt und Systemnamen nicht allgemein
gelten. Die relative Formulierung ist selbstbegrenzend: Sie wirkt genau dort, wo die
benannte Klasse von Quellen auftritt. Damit entfallen die drei Mechanismen, die ein
Geltungsbereich verlangt hätte – Spezifitätsvergleich, Widerspruchsprüfung und
Erklärungspfad –, und zwar nicht durch Verzicht auf Ausdruckskraft, sondern weil die
Unterscheidung an der Wirklichkeit statt an der Konfiguration hängt.

**Zu A2 – warum zwei Formen der Sperre.** `Automatik hat Vorrang` und `manuell gesperrt`
sehen ähnlich aus und sind es nicht. Beim ersten Wert bleibt ein Feld dort von Hand
pflegbar, wo keine automatische Quelle es bespielt; beim zweiten nie. Der zweite Wert wird
für abgeleitete Größen gebraucht: Die Bruttokapazität entsteht nach §18 aus Nettoparametern
und Overhead-Modell. Sie von Hand setzen zu können, wäre kein Komfort, sondern ein Weg,
die Berechnung stillschweigend zu entwerten.

**Zu A4 – warum die Herkunft und nicht der Transportweg.** Ein Dateiupload ist mal ein
maschineller Massenvorgang und mal ein Mensch mit einer Tabelle. Würde die Klasse am
Transportweg hängen, hätte derselbe Vorgang je nach Werkzeug eine andere Wirkung – genau
die Unterscheidung, die §19.2 ausdrücklich ausschließt.

**Zu A5 – warum kein Geltungsbereich.** Es gibt genau einen Fall, den „je Feld" nicht
ausdrücken kann: Zwei Mandanten haben **beide** eine automatische Quelle und beurteilen
deren Verlässlichkeit unterschiedlich. Dieser Fall ist denkbar, aber nicht eingetreten.
Ihn vorab zu bauen hieße, drei zu testende Mechanismen und eine deutlich größere
Konfigurationsfläche für eine Vermutung anzulegen – gegen die Warnung in ADR-0011, dass
diese Fläche ohne verständliche Oberfläche unbeherrschbar wird.

**Zu A6 – warum trotzdem die leere Spalte.** Sie kostet heute nichts und ist der
Unterschied zwischen einem `INSERT` und einer Migration an bereits produktiv gepflegten
Konfigurationsdaten. Der Zeitpunkt, zu dem man sie braucht, ist der schlechteste, um sie
einzuführen.

**Zu B1 bis B5 – warum es einen Ausnahmeweg geben muss.** Ohne ihn führt ein falscher Wert
der führenden Quelle in eine Sackgasse: Das Feld ist für Menschen gesperrt, und die
Korrektur müsste über ein Fremdsystem laufen, auf das der Betreiber möglicherweise keinen
Zugriff hat. Eine Regel, aus der es keinen Ausweg gibt, wird im Ernstfall nicht
eingehalten, sondern umgangen – und zwar auf einem Weg, der nirgends verzeichnet ist. B3
stellt sicher, dass der Ausweg selbst nachweisbar bleibt: Ohne eigene Herkunftskennung
sähe die Korrektur in der Historie aus wie ein gewöhnlicher Import, und der Nachweis nach
§19.4 wäre an genau der Stelle wertlos, an der er gebraucht wird.

**Zu B6 – warum das Festhalten nicht am Regelwerk hängt.** Es wirkt unabhängig davon,
welchen Wert die Regel aus A2 hat, und löst denselben Konflikt von der anderen Seite. Beim
Vorgabewert `manuell erlaubt` wird eine manuelle Änderung angenommen und in der nächsten
Nacht überschrieben – der Fall aus dem einleitenden Beispiel. Die Regel zu verschärfen
hilft dort nicht: Sie würde die manuelle Änderung von vornherein abweisen, statt sie
bestehen zu lassen. Das Festhalten ist die einzige Ausnahme, die den Einzelfall regelt,
ohne den Regelfall zu ändern.

**Zu B7 und B8 – warum ausdrücklich und mit Begründung.** Eine Festhaltung, die als
Nebenwirkung einer Korrektur entsteht, wird unbemerkt gesetzt und bleibt unbemerkt
bestehen. Nach einem Jahr weiß niemand mehr, welche Felder warum vom Herkunftssystem
abweichen, und der einzige verbleibende Weg ist, sie versuchsweise aufzuheben. Die
Begründung ist deshalb kein Formalismus, sondern das, was die Festhaltung später wieder
aufhebbar macht.

**Zu B10 – warum die abgewiesene Lieferung trotz ihrer Menge verzeichnet wird.** Ein
festgehaltenes Feld erzeugt bei jedem Lauf einen Eintrag, auch wenn sich nichts ändert.
Das ist mengenmäßig unerheblich – bei hundert festgehaltenen Feldern und nächtlichem Lauf
entstehen im Jahr wenige zehntausend Zeilen –, und der Ertrag ist erheblich: Ohne diese
Aufzeichnung wäre eine Festhaltung nur als Zustand belegbar, nicht als Entscheidung. Die
Aussage, die eine Festhaltung im Streitfall tragen muss, lautet nicht „dieses Feld war
gesperrt", sondern **„das Herkunftssystem hat X geliefert, wir haben aus dem in B8
genannten Grund bei Y bleiben wollen"**. Der erste Satz ist eine technische Angabe, der
zweite ein Nachweis.

Dass die Auskunft im Herkunftssystem selbst abfragbar wäre, hilft nicht: Dort steht der
heutige Wert, nicht der von vor acht Monaten – und ob es das System dann noch gibt, ist
nach [ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md) ausdrücklich offen.

**Zu B14 – warum die Übersicht Bestandteil der Entscheidung ist.** Festgehaltene Felder
wachsen und schrumpfen nie von selbst. Ohne einen Ort, an dem sie vollständig sichtbar
sind, entsteht genau der schleichende Auseinanderlauf, den B13 am einzelnen Datensatz
verhindern soll – nur eben verteilt und dadurch unbemerkt. Die Übersicht als spätere
Verbesserung zu behandeln hieße, die Festhaltung ohne ihr Gegengewicht einzuführen.

**Zu C1 – warum der Mandant nicht Keycloak gehört.** Kostenstellen, Kapazitätsbudgets und
Freigabezuständigkeiten sind Fachdaten. Lägen sie in Keycloak, wäre die
Identitätsverwaltung zugleich Stammdatenverwaltung, und ein Wechsel des
Identitätsanbieters nähme sie mit – die in ADR-0015 gewonnene Austauschbarkeit wäre
dahin. Die Zugehörigkeit im Token zu führen genügt vollständig.

**Zu C3 – warum Mehrfachzugehörigkeit von Beginn an.** Nachträglich eingeführt bricht sie
jede Stelle, die den Mandanten aus der Identität ableitet. Bei einem Berechtigungsmodell
nach §8 sind das sehr viele Stellen.

## Betrachtete Alternativen

### Kontext als Tupel benannter Dimensionen

Der Geltungsbereich wäre ein Tupel aus Mandant, Anforderungstyp und
Bereitstellungskategorie; die Dimensionen selbst Stammdaten, die spezifischere Regel
gewinnt, Gleichstand wird beim Speichern abgewiesen.

Vorteile: deckt auch den Fall zweier Mandanten mit unterschiedlich verlässlichen
Vorsystemen ab; eine neue Dimension bleibt ein Datensatz.

**Nicht gewählt.** Mit dem relativen Vokabular aus A1 fallen die Fälle zusammen, für die
das Tupel gebraucht würde. Übrig bliebe ein Mechanismus mit drei zu testenden Bestandteilen
für einen Fall, der noch nicht eingetreten ist. A6 hält den Weg dorthin offen, falls er
eintritt.

### Kontext gleich Anforderungstyp (die Annahme aus ADR-0011)

**Nicht gewählt.** Diese Dimension kann den wahrscheinlichsten Fall – zwei Mandanten mit
verschiedenen Vorsystemen – ohnehin nicht ausdrücken, und mit A1 wird sie für die übrigen
Fälle nicht gebraucht. Die Annahme war in ADR-0011 ausdrücklich als vor M3 zu bestätigen
oder zu korrigieren gekennzeichnet; sie wird hiermit korrigiert.

### Absolute Regeln mit Nennung des führenden Systems

**Nicht gewählt.** Sie erzwingen einen Geltungsbereich und binden die Konfiguration an
Systemnamen. Ein Wechsel des Vorsystems würde dann nicht nur die Anbindung betreffen,
sondern jede Hoheitsregel, die es nennt.

### Kein Ausnahmeweg für Berechtigte

**Nicht gewählt.** Siehe Begründung zu B1 bis B5: Eine Sperre ohne Ausweg wird umgangen
statt eingehalten, und der Umgehungsweg ist nicht nachweisbar.

### Festhalten als selbsttätige Folge jeder manuellen Änderung

Jede von Hand vorgenommene Änderung hielte das betroffene Feld künftig gegen automatische
Übernahme fest, ohne dass jemand es erklären müsste.

Vorteile: Der Fall aus dem einleitenden Beispiel löst sich, ohne dass Anwender etwas lernen
müssen. Wer etwas von Hand ändert, will offensichtlich, dass es so bleibt.

**Nicht gewählt.** „Offensichtlich" trifft nur auf einen Teil der Fälle zu – eine Korrektur
eines Tippfehlers ist etwas anderes als eine bewusste Abweichung vom Herkunftssystem. Die
Plattform liefe innerhalb weniger Monate an hunderten unbemerkt festgehaltenen Feldern
auseinander, und niemand könnte zu einem davon sagen, warum. B7 und B8 verlangen die
Erklärung deshalb im Moment der Entscheidung, in dem sie noch jemand geben kann.

### Mandant als eigener Keycloak-Realm

**Nicht gewählt** – widerspricht ADR-0015 unmittelbar; dessen Begründung gilt unverändert.

## Konsequenzen

### Positiv

- Die Konfiguration besteht je Feld aus **einem** Wert aus einer Auswahl von dreien. Das
  ist auch für Fachanwender ohne Erläuterung verständlich – die Voraussetzung dafür, dass
  die Regeln überhaupt gepflegt werden
- Es entsteht kein Auflösungsmechanismus, der getestet, erklärt und in der Oberfläche
  dargestellt werden müsste
- Eine Regel ist über Mandanten hinweg übertragbar, weil sie keine Systemnamen enthält
- Der Ausnahmeweg ist vorhanden **und** nachweisbar
- **Der Einzelfall ist regelbar, ohne den Regelfall zu ändern.** Eine einzelne Abweichung
  vom Herkunftssystem verlangt keine schärfere Regel für alle Datensätze
- **Eine Festhaltung ist als Entscheidung belegbar, nicht nur als Zustand.** Aus B8, B9 und
  B10 zusammen ergibt sich, wer wann aus welchem Grund welchen gelieferten Wert nicht
  übernommen hat – die Auskunft, auf die es im Streitfall ankommt
- Der Wechsel des Identitätsanbieters nimmt keine fachlichen Mandantendaten mit

### Negativ

- **Der Fall zweier Mandanten mit unterschiedlich verlässlichen Vorsystemen ist nicht
  abbildbar.** Tritt er ein, ist ein neues ADR fällig; A6 sorgt dafür, dass es dann eine
  Erweiterung ist und kein Umbau
- **Eine Korrektur ohne Festhaltung wird stillschweigend zurückgesetzt.** Da die
  Festhaltung nach B7 ausdrücklich erklärt werden muss, ist der Regelfall die Korrektur
  *ohne* sie. Die Oberfläche muss beim Auslösen darauf hinweisen, dass der nächste
  automatische Lauf sie überschreibt, und das Festhalten an derselben Stelle anbieten. Ein
  stiller Rücksetzer wäre schlimmer als die Sperre, die er umgeht
- **Festgehaltene Felder sind gewollte, dauerhafte Abweichungen vom Herkunftssystem.**
  Ihre Zahl wächst und schrumpft nie von selbst. B14 macht sie sichtbar, ersetzt aber
  keine wiederkehrende Durchsicht – die Übersicht ist die Voraussetzung dafür, nicht ihr
  Ersatz
- **B10 erzeugt Datenmenge ohne Informationszuwachs je Zeile.** Ein festgehaltenes Feld,
  dessen Herkunftssystem monatelang denselben Wert liefert, erzeugt monatelang dieselbe
  Zeile. Das ist tragbar, verlangt aber ein Aufbewahrungskonzept – `PROD-020`, das durch
  ADR-0012 bereits verschärft wurde, erfasst damit einen zweiten Speicher
- **B10 und B11 erzeugen einen zweiten Speicher neben der Versionshistorie.** Das ist
  begründet, aber es bleibt eine zusätzliche Struktur mit eigenem Schema, eigener
  Aufbewahrung und eigener Löschfrage – und die Versuchung, sie später doch für Auskünfte
  zu verwenden, für die die Versionshistorie zuständig ist
- **A4 setzt voraus, dass Herkunftssysteme als Stammdaten geführt werden**, mit dem
  Merkmal automatisch oder manuell. Heute ist `sourceSystem` eine freie Zeichenkette mit
  dem Vorgabewert `infrademand`. Diese Registratur entsteht mit M3 und ist Voraussetzung,
  nicht Nebenprodukt
- **C3 macht den wirksamen Mandanten zum Bestandteil des Anfragekontexts.** Das betrifft
  den Weiterleitungspfad aus M2.4, die Tokenprüfung der Services und jede Abfrage

### Offen

- **Ob eine Festhaltung von selbst verfällt.** Eine Befristung – „gilt bis" – würde die
  wiederkehrende Durchsicht erzwingen, statt sie vorauszusetzen. Sie schafft aber ihrerseits
  einen stillen Rücksetzer zum Ablaufzeitpunkt, und der ist genau das, was B12 verhindern
  soll. Zu entscheiden, wenn Erfahrung aus dem Betrieb vorliegt
- **Wahl des wirksamen Mandanten bei Mehrfachzugehörigkeit** – Auswahl in der Oberfläche,
  Bestandteil des Pfades, oder aus dem angesprochenen Objekt abgeleitet. Zu entscheiden
  mit M5: Solange es einen Mandanten gibt, ist die Frage ohne Wirkung
- **Verhalten bei Abweisung** – Fehler, stilles Verwerfen oder Vormerken zur Klärung.
  Bleibt wie in ADR-0011 vorgesehen bei M3
