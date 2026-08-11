# ADR-0021: Anbindung externer Workflows

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §7, §12, §19.2, §19.3
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Ergänzung der fachlichen Vorgabe beim Zuschnitt von M4:

> Es soll auch die Möglichkeit geben, dass der Workflow einen externen Workflow anspricht
> (z. B. Jira oder eine CMDB). Dabei können auch wieder Rückgabewerte kommen, oder auch
> nicht.

Auf Nachfrage präzisiert: Eine **synchrone** Form – fragen und die Antwort unmittelbar im
Übergang verwenden – wird nach heutigem Stand nicht gebraucht. Es gibt jedoch Fälle, in
denen **das externe System führt**: Jira treibt den Vorgang, wir ziehen nach.

Damit stehen drei Formen im Raum, von denen zwei umgesetzt werden müssen:

| Form | Gebraucht |
|---|---|
| Anstoßen ohne Antwort | ja |
| Anstoßen und später eine Antwort erhalten | ja |
| Fragen und die Antwort sofort im Übergang verwenden | **nein**, Stand heute |

Das „oder auch nicht" ist dabei kein Randfall: Ein externes System, das nie antwortet, ist
der Normalfall. Tickets werden vergessen, Schnittstellen laufen ab, Vorgänge werden
außerhalb abgebrochen.

## Entscheidung

**1. Ein Übergang hängt nie von der Erreichbarkeit eines Fremdsystems ab.**
Es gibt keinen synchronen Aufruf im Übergang. Unsere Verfügbarkeit bleibt damit unabhängig
von der eines Fremdsystems.

**2. Warten ist ein Zustand, keine Lücke zwischen Zuständen.**
Wartet ein Vorgang auf ein externes Ergebnis, befindet er sich in einem eigenen, benannten
Zustand des Graphen.

**3. Jedes Warten trägt eine Frist und einen Ausweg.**
Zur Frist gehört ein festgelegtes Verhalten – Übergang in einen anderen Zustand oder
Meldung. Unabhängig davon kann ein Berechtigter den Vorgang jederzeit von Hand
weiterführen.

**4. Eine Workflow-Definition ist entweder eigengeführt oder fremdgeführt.**

| | Wer entscheidet den Übergang | Rolle des Graphen |
|---|---|---|
| **eigengeführt** | wir; ein externer Rückruf *löst* einen definierten Übergang aus | prüft und weist ab |
| **fremdgeführt** | das externe System; wir ziehen nach | beschreibt, prüft nicht |

**5. Bei fremdgeführten Workflows weist der Graph nichts ab.**
Ein Zustand, den das führende System meldet und den unser Graph nicht kennt, wird
**übernommen und vermerkt**, nicht zurückgewiesen.

**6. Der Rückkanal ist ein gewöhnlicher Eingangsweg.**
Eine Rückmeldung ist eine Schreiboperation aus fremder Quelle und läuft durch dieselben
Mechanismen wie jede andere: eingetragenes Herkunftssystem mit Quellenklasse
([ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A4), Prüfung der
dynamischen Attribute (§19.2), Hoheitsregeln je Feld (§19.3), Versionierung
([ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md)).

**7. Wirkungen sind idempotent.**
Eine wiederholte Ausführung erzeugt kein zweites Ticket. Der Schlüssel ist derselbe wie in
§19.1: Herkunftssystem und dortiger Bezeichner.

**8. Die eigene Zustandsmaschine bleibt.**
§7 nennt Camunda oder Zeebe „für komplexere Fälle". Mit Punkt 1 und 2 bleibt der Fall
einfach genug: Es braucht einen Zeitgeber für Fristen und eine Zuordnung eingehender
Rückmeldungen – nicht mehr. **Auslöser für eine Neubewertung:** parallele Zweige,
Ausgleichsschritte oder Vorgänge, die mehrere Fremdsysteme koordinieren.

**9. Umgesetzt wird mit M4.3 und später**, nicht jetzt. Diese Entscheidung legt die
Begriffe fest, damit der Graph aus M4.1 sie tragen kann.

## Begründung

**Zu 1 – warum kein synchroner Aufruf, selbst wenn er einmal bequem wäre.** Ein Übergang,
der auf eine Antwort wartet, macht unseren Dienst von der Verfügbarkeit eines fremden
abhängig. Fällt die CMDB aus, kann niemand mehr einen Status ändern – und zwar auch in
Vorgängen, die mit der CMDB nichts zu tun haben, weil die Anfrage im selben Aufruf hängt.
Diese Kopplung ist genau die, die [ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md)
an anderer Stelle ausschließt. Sie wird hier nicht deshalb vermieden, weil sie fachlich
unnötig ist, sondern weil sie teuer und leicht unbeabsichtigt einzuführen ist.

**Zu 2 – warum Warten ein Zustand sein muss.** Wäre es eine Eigenschaft des Übergangs,
gäbe es keinen Ort, an dem der Vorgang sich befindet. Er wäre weder in einer Liste
sichtbar, noch ließe sich sagen, worauf er wartet, noch gäbe es einen Punkt, von dem aus
fortgesetzt wird. Ein benannter Zustand beantwortet alle drei Fragen ohne Zusatzaufwand –
er ist auswertbar, anzeigbar und Ausgangspunkt eines Übergangs.

**Zu 3 – warum Frist und Ausweg zusammengehören.** Eine Frist ohne Ausweg verschiebt das
Steckenbleiben nur; ein Ausweg ohne Frist verlangt, dass jemand das Steckenbleiben bemerkt.
Beides zusammen deckt beide Fälle ab: den vergessenen Vorgang und den, bei dem jemand
zusieht. Dieselbe Überlegung wie bei ADR-0017 B6 – eine Regel, aus der es keinen Ausweg
gibt, wird nicht eingehalten, sondern umgangen.

**Zu 4 und 5 – warum ein fremdgeführter Graph nicht prüfen darf.** Führt das externe
System, ist sein Zustand der richtige. Weist unser Graph einen Übergang ab, den es
vorgenommen hat, laufen beide dauerhaft auseinander – und unserer liegt falsch, weil wir
nicht führen. Eine Prüfung, die im Konfliktfall garantiert das Falsche tut, ist schlechter
als keine.

Der Graph verliert dabei nicht seinen Zweck: Er beschreibt weiterhin, welche Zustände es
gibt und was sie bedeuten, und trägt die Darstellung in der Oberfläche. Er entscheidet nur
nichts mehr.

Das Vermerken aus Punkt 5 folgt [ADR-0019](0019-verhalten-bei-abgewiesener-schreiboperation.md):
Wo niemand anwesend ist, wird verzeichnet und fortgefahren. Ein unbekannter Zustand aus
Jira ist ein Hinweis darauf, dass unser Graph veraltet ist – aber kein Grund, die Meldung
zu verwerfen.

**Zu 6 – warum der Rückkanal nichts Neues braucht.** Das war das erfreulichste Ergebnis
der Betrachtung: Eine Rückmeldung aus Jira ist ein Schreibvorgang einer automatischen
Quelle. Jira wird als Herkunftssystem eingetragen, seine Rückgabewerte laufen durch die
Attributprüfung, und die Hoheitsregeln entscheiden, ob sie ein Feld überschreiben dürfen.
Drei der vier Anforderungen an eine externe Anbindung fallen damit in Mechanismen, die
bereits stehen.

**Zu 8 – warum keine Prozess-Engine.** Camunda und Zeebe lösen ein Problem, das wir mit
Punkt 1 nicht haben: langlaufende Vorgänge mit synchronen Aufrufen, Ausgleichsschritten
und parallelen Zweigen. Was übrig bleibt – Fristen und die Zuordnung von Rückmeldungen –
ist überschaubar und ohne einen zusätzlichen Dienst zu haben, der eigene Betriebs-,
Aktualisierungs- und Ausfallfragen mitbringt. Der Auslöser für eine Neubewertung ist
genannt, damit die Entscheidung nicht stillschweigend fortgeschrieben wird.

## Betrachtete Alternativen

### Synchroner Aufruf im Übergang

Der Übergang ruft das Fremdsystem und verwendet die Antwort unmittelbar.

Vorteile: keine Wartezustände, kein Rückkanal, kein Zeitgeber. Deutlich weniger Bauteile.

**Nicht gewählt.** Fachlich derzeit nicht gebraucht, und die Kopplung wäre erheblich: Ein
langsames oder ausgefallenes Fremdsystem legt Statuswechsel lahm, auch solche, die es gar
nicht betreffen. Sollte der Bedarf entstehen, ist es eine eigene Entscheidung mit einer
ausdrücklichen Aussage darüber, welche Vorgänge dadurch von wem abhängig werden.

### Fremdgeführte Vorgänge ebenfalls gegen den Graphen prüfen

Auch wenn Jira führt, prüft unser Graph jeden gemeldeten Übergang.

Vorteile: ein Verhalten für alle Workflows, keine zwei Betriebsarten, und unser Graph
bleibt in jedem Fall die Wahrheit über zulässige Zustände.

**Nicht gewählt**, weil unser Graph in diesem Fall gerade **nicht** die Wahrheit ist. Eine
Abweisung erzeugte einen dauerhaften Widerspruch zwischen zwei Systemen, bei dem unseres
das falsche wäre. Die vermeintliche Einheitlichkeit erkauft man mit garantiert falschen
Daten.

### Kein eigener Graph bei fremdgeführten Vorgängen

Fremdgeführte Vorgänge tragen schlicht die Zeichenkette, die das externe System liefert.

Vorteile: nichts zu pflegen, keine Abweichung zwischen zwei Zustandslisten.

**Nicht gewählt.** Ohne Zustandsliste gibt es keine Übersetzung in verständliche
Bezeichnungen, keine Darstellung, keine Auswertung nach Zuständen und keinen Hinweis
darauf, dass ein unbekannter Zustand aufgetaucht ist. Der Graph beschreibt dann eben, was
er nicht mehr entscheidet.

### Camunda oder Zeebe

**Nicht gewählt**, siehe Begründung zu 8. Der Auslöser für eine Neubewertung ist dort
benannt.

## Konsequenzen

### Positiv

- Die Verfügbarkeit des Dienstes hängt nicht an der von Fremdsystemen
- Wartende Vorgänge sind sichtbar, benannt und auswertbar – nicht in einem Zwischenraum
- Der Rückkanal braucht keine eigene Maschinerie: Herkunftsregistratur, Attributprüfung,
  Hoheitsregeln und Versionierung greifen unverändert
- Ein unbekannter Zustand aus einem führenden System geht nicht verloren, sondern wird zum
  Hinweis, dass der eigene Graph nachzuziehen ist

### Negativ

- **Zwei Betriebsarten sind zwei Verhaltensweisen.** Wer den Schreibpfad liest, muss
  wissen, dass der Graph nicht immer prüft. Die Unterscheidung gehört an die Verzweigung
  im Code, nicht nur in dieses Dokument
- **Fristen verlangen einen Zeitgeber.** Damit bekommt der Dienst erstmals einen
  zeitgesteuerten Vorgang – mit den zugehörigen Fragen: Was passiert bei mehreren
  Instanzen, was bei einem Ausfall während der Ausführung
- **Der Ausweg aus Punkt 3 ist ein Recht, das jemand haben muss.** Wer einen wartenden
  Vorgang von Hand weiterführt, umgeht damit eine externe Genehmigung. Das gehört unter §8
  und auffällig auditiert
- **Fremdgeführte Vorgänge sind nur so verlässlich wie ihre Rückmeldungen.** Bleibt eine
  aus, steht bei uns ein veralteter Zustand, ohne dass es auffällt. Eine Abgleichsprüfung
  gegen das führende System wäre die Abhilfe – sie ist nicht Teil dieser Entscheidung

### Offen

- **Wie eine Rückmeldung dem wartenden Vorgang zugeordnet wird** – über einen von uns
  vergebenen Bezeichner im Fremdsystem oder über dessen Bezeichner bei uns
- **Verhalten bei Fristablauf je Übergang oder je Workflow** – und ob es mehrere Fristen
  mit verschiedenen Folgen geben soll
- **Abgleich fremdgeführter Vorgänge**, falls Rückmeldungen ausbleiben
- **Ob eine Wirkung zurückgenommen werden kann**, wenn der Vorgang danach in einen anderen
  Zustand geht – das angelegte Jira-Ticket bleibt sonst bestehen
