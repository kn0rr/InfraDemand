# ADR-0026: Wirksamer Mandant und Stufung der Konfiguration

- **Status:** Angenommen
- **Datum:** 2026-08-12
- **Betrifft:** CLAUDE.md §6, §8, §15
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) Teil C hält fest:
Der Mandant ist eine fachliche Entität der Plattform, Keycloak stellt ausschließlich die
Zugehörigkeit fest, und **ein Anwender kann mehreren Mandanten angehören**. Die Auflösung
dieses Falls wurde dort ausdrücklich vertagt.

Ohne sie ist der Mandantenzuschnitt aus §8 nicht umsetzbar: Jede Prüfung müsste wissen, in
wessen Namen sie läuft. Der Bestand kennt den Begriff bisher gar nicht – `requirement`
trägt `projectId`, aber keinen Mandanten.

### Was die Konfiguration betrifft

Die zweite, schwerwiegendere Frage: Tragen auch Attributdefinitionen, Hoheitsregeln und
Workflow-Definitionen einen Mandanten? Heute sind sie plattformweit. Wären sie es weiter,
könnte kein Mandant einen eigenen Genehmigungsweg festlegen, und §15 wäre nur halb erfüllt.

### Ein vorhandener Fall ohne Auflösung

Attributdefinitionen sind bereits einstufig gestaffelt: `unique(key, requirement_type)` mit
`NULLS NOT DISTINCT` erlaubt denselben Schlüssel einmal allgemein und einmal je
Anforderungstyp. Ein Test sichert das ausdrücklich zu.

`pruefeDynamischeAttribute` läuft anschließend über **alle** gelieferten Definitionen. Ein
Schlüssel mit zwei Definitionen wird damit zweimal geprüft; bei widersprüchlichen
Wertelisten ist er unerfüllbar. Das hat niemand entschieden – es folgt aus der Schleife.

Mit einer zweiten Dimension würden aus zwei möglichen Definitionen je Schlüssel vier. Die
Rangfolge ist deshalb Bestandteil dieser Entscheidung.

## Entscheidung

**1. Für die Berechtigung gilt der Mandant des Objekts.**
Die Frage lautet nie „welcher Mandant ist gerade wirksam", sondern **„gehört der Handelnde
dem Mandanten dieses Datensatzes an"**. Es gibt keinen wirksamen Mandanten als
Sitzungszustand.

**2. Die Auswahl in der Oberfläche ist eine Ansichtsvorwahl ohne Sicherheitswirkung.**
Sie schränkt Listen ein und füllt beim Anlegen vor. Sie kann **nichts freigeben**, was
Punkt 1 nicht ohnehin erlaubt. Damit muss sie auch nicht gegen Manipulation geschützt
werden.

**3. Jede Anforderung trägt einen Mandanten**, `NOT NULL`, ohne Vorgabewert. Der Anlegeweg
setzt ihn und prüft ihn gegen die Zugehörigkeiten im Token.

**4. Die Konfiguration ist gestuft: plattformweite Vorgabe plus mandantenspezifische
Ergänzung.** Ein leerer Mandant an einer Definition bedeutet „gilt für alle" – dieselbe
Bedeutung, die ein leerer Anforderungstyp dort bereits hat.

Betroffen sind Attributdefinitionen, Hoheitsregeln und Workflow-Definitionen.

**5. Je Schlüssel gilt genau eine Definition – die spezifischste.**
Die Rangfolge, von stark nach schwach:

| Rang | Mandant | Anforderungsart |
|---|---|---|
| 1 | dieser | diese |
| 2 | alle | diese |
| 3 | dieser | alle |
| 4 | alle | alle |

**Die Anforderungsart wiegt schwerer als der Mandant.** Begründung unten.

**6. Der Mandant ist in M5 ein Bezeichner aus dem Token**, kein Datensatz. Bezeichnung,
Kostenstellen und Zuständigkeiten kommen mit dem Identity & Access Service (M6). Die
Zugehörigkeit erreicht die Anwendung als Anspruch, wie ADR-0017 C2 es beschreibt.

**7. Herkunftssysteme bleiben plattformweit.** Eine Quelle ist eine Anbindung, keine
Eigenschaft eines Mandanten. Sollte sich das ändern, ist es eine eigene Entscheidung.

## Begründung

**Zu 1 – warum am Objekt und nicht in der Sitzung.** Ein wirksamer Mandant als
Sitzungszustand erzeugt drei Folgefragen: Wie kommt er über die Leitung? Wie wird
verhindert, dass ein Aufrufer ihn fälscht? Was gilt, wenn er nicht zum angefragten
Datensatz passt? Am Objekt entfallen alle drei. Die Prüfung ist überall dieselbe und
braucht keinen Zustand, der zwischen zwei Aufrufen verlorengehen kann.

Übrig bleiben genau zwei Stellen, an denen kein Objekt existiert: das Anlegen und die
Liste. Dafür genügt eine Vorwahl – und weil sie nur einschränkt, ist sie harmlos. **Eine
Auswahl, die nichts freigibt, muss nicht geschützt werden.**

**Zu 3 – warum kein Vorgabewert.** Ein Wert wie „standard" wäre ein erfundener Mandant, und
die erste Frage nach Mandantenfähigkeit hätte eine falsche Antwort. Dieselbe Überlegung wie
bei der Workflow-Bindung in [ADR-0022](0022-statuswechsel-als-eigener-vorgang.md): Wo die
Fachtabelle keinen Vorgabewert hat, verlangt der Übersetzer die Angabe an jeder Stelle, die
schreibt.

**Zu 5 – warum die Anforderungsart schwerer wiegt als der Mandant.** Der Fall, an dem es
sich entscheidet:

> Die Plattform legt für `bestellung` fest, dass ein Lieferdatum Pflicht ist – ein
> hausweiter Beschaffungsprozess. Ein Mandant legt allgemein fest, dass Lieferdaten
> optional sind.

Wögen sie umgekehrt, hebelte die allgemeine Regel des Mandanten den hausweiten Prozess für
Bestellungen aus, ohne dass jemand über Bestellungen gesprochen hätte. Mit dieser Rangfolge
kann ein Mandant den Prozess für Bestellungen ändern – aber nur, indem er ihn **für
Bestellungen** benennt. Die spezifische Aussage schlägt die allgemeine, gleich aus welcher
Richtung.

**Zu 5 – warum genau eine Definition und nicht mehrere.** Zwei Definitionen für denselben
Schlüssel sind nicht zwei Regeln, sondern zwei Antworten auf dieselbe Frage. Sie beide
anzuwenden – wie es heute geschieht – kann zu einer unerfüllbaren Verbindung führen, ohne
dass irgendwo eine Fehlermeldung entsteht: Das Attribut ist dann einfach nie gültig zu
befüllen. Die Auswahl der spezifischsten ist die einzige Auflösung, die sich in einem Satz
erklären lässt.

**Zu 4 – warum gestuft und nicht je Mandant getrennt.** Eine vollständige Trennung würde
jede Definition in jedem Mandanten neu verlangen; gemeinsame Vorgaben wären nicht
ausdrückbar, und ein neuer Mandant startete mit leerem Datenmodell. Die Stufung ist zudem
kein neues Muster – der leere Anforderungstyp bedeutet seit M3 dasselbe.

## Betrachtete Alternativen

### Wirksamer Mandant aus dem Token

Das Token trägt genau einen; ein Wechsel verlangt eine neue Anmeldung.

**Nicht gewählt.** ADR-0017 C3 hält die Mehrfachzugehörigkeit ausdrücklich fest; sie wäre
damit zwar abbildbar, aber unbenutzbar. Außerdem verschöbe es die Frage nur nach Keycloak,
wo sie schwerer zu beantworten ist.

### Wirksamer Mandant als Kopffeld der Anfrage

Der Aufrufer nennt den Mandanten je Anfrage; der Dienst prüft ihn gegen die
Zugehörigkeiten.

**Nicht gewählt.** Es funktionierte, verlangt aber eine Prüfung an jeder schreibenden und
lesenden Stelle und beantwortet nicht, was bei einem Widerspruch zum Datensatz gilt. Der
Mandant am Objekt liefert dieselbe Sicherheit ohne diese Frage.

### Konfiguration ausschließlich plattformweit

Kein Mandantenbezug an Definitionen; alle teilen dieselben Attribute, Regeln und Workflows.

**Nicht gewählt.** Es wäre die kleinste Änderung – eine Spalte an `requirement` und ein
Filter – erfüllt §15 aber nur zur Hälfte: Mandantenfähigkeit ohne eigene Regeln ist eine
Trennung der Daten, nicht der Fachlichkeit.

### Konfiguration vollständig je Mandant

Jede Definition gehört genau einem Mandanten; nichts wird geteilt.

**Nicht gewählt**, siehe Begründung zu 4.

## Konsequenzen

### Positiv

- Die Berechtigungsprüfung ist überall dieselbe und braucht keinen Sitzungszustand
- Die Vorwahl in der Oberfläche ist sicherheitsneutral und damit unkritisch
- Ein Mandant kann eigene Regeln setzen, ohne dass gemeinsame Vorgaben verschwinden
- **Der vorhandene, unaufgelöste Fall wird mit behoben:** Auch ohne Mandanten gilt künftig
  je Schlüssel genau eine Definition

### Negativ und Risiken

- **Vier Tabellen bekommen eine Spalte und geänderte Eindeutigkeiten.** Bei den Workflows
  wird aus `unique(requirement_type)` ein `unique(mandant, requirement_type)` – eine
  Migration, die den Zugriffspfad jeder Auflösung berührt
- **Die Rangfolge ist eine Regel, die man kennen muss.** Wer eine Definition anlegt und
  eine spezifischere übersieht, wundert sich, warum sie nicht greift. Die
  Verwaltungsoberfläche sollte anzeigen, welche Definition für eine gegebene Kombination
  tatsächlich gilt – nachzuziehen mit M5.4
- **Bestehende Definitionen mit doppeltem Schlüssel ändern ihr Verhalten.** Bisher wirkten
  beide, künftig nur die spezifischere. Für den Entwicklungsbestand folgenlos, aber es ist
  eine Verhaltensänderung ohne Schemaänderung – genau die Sorte, die `PROD-049` beschreibt
- **Der Mandant ist bis M6 ein Bezeichner ohne Entität.** Es gibt keine Liste gültiger
  Mandanten, gegen die geprüft werden könnte; maßgeblich ist allein das Token. Wer dort
  einen Anspruch setzt, setzt einen Mandanten

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Woher die Zugehörigkeiten im Token stammen – Keycloak-Organizations oder Gruppen | Meilenstein M6 mit dem Identity & Access Service |
| Ob Herkunftssysteme einen Mandantenbezug brauchen | Wenn ein Mandant eine eigene Anbindung verlangt |
| Anzeige der tatsächlich geltenden Definition in der Verwaltungsoberfläche | Meilenstein M5.4 |
| Ob ein Mandant eigene Rollen führen darf oder nur die des Realms | Meilenstein M6 |
