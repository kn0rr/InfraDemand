# ADR-0025: Umgang mit der gebundenen Workflow-Fassung

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §7
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Seit M4.2 ist jede Anforderung an eine bestimmte **Fassung** einer Workflow-Definition
gebunden; jeder Statuswechsel läuft gegen diese Fassung und nicht gegen den aktuellen
Workflow ([ADR-0022](0022-statuswechsel-als-eigener-vorgang.md)). Das ist die Zusicherung
aus §7: Eine Änderung der Definition wirkt nicht rückwirkend.

Aus der Bindung folgen drei Fragen, die bisher offen oder nur stillschweigend beantwortet
sind.

**Was bedeutet ein außer Kraft gesetzter Workflow für laufende Anforderungen?** Heute
prüft die Suche nach dem geltenden Workflow das Kennzeichen `active`, der Lesezugriff auf
die gebundene Fassung nicht. Laufende Anforderungen laufen also weiter, neue entstehen
nicht mehr. **Das hat niemand entschieden** – es folgt aus dem Code.

**Was ist von der Bindung sichtbar?** Die Antwort einer Anforderung nennt sie nicht, und es
gibt keine Auskunft darüber, welche Fassungen noch in Gebrauch sind.

**Kann eine laufende Anforderung auf eine neuere Fassung gehoben werden?** Bisher nicht.
Seit M4.3 wiegt das schwerer: Übergänge tragen Rollen, Vier-Augen-Bezüge und
Pflichtfelder. Ist eine davon falsch gesetzt, stecken alle laufenden Anforderungen fest –
eine neue Fassung hilft ihnen nicht, denn sie sind an die alte gebunden.

Der einzige heutige Ausweg wäre, die Anforderungsart zu wechseln, damit
[ADR-0023](0023-workflow-bindung-beim-typwechsel.md) neu bindet. Das ist der Missbrauch
eines anderen Vorgangs.

### Was nicht offen ist

Der Meilensteinplan führte als M4.4-Inhalt auch *„was gilt, wenn die gebundene Fassung den
Zustand nicht mehr führt"*. Der Fall kann aus der Bindung heraus nicht entstehen:
Historienzeilen werden nie geändert, die gebundene Fassung trägt dauerhaft genau die
Zustände, die sie beim Binden hatte. Er entsteht ausschließlich beim Wechsel der
Anforderungsart – und dafür gibt es die Meldung und den Zuordnungsvorgang aus ADR-0022
Punkt 5.

## Entscheidung

**1. Ein außer Kraft gesetzter Workflow hält laufende Anforderungen nicht an.**
`active = false` verhindert, dass neue Anforderungen unter diesem Workflow entstehen. Was
läuft, läuft unter seiner gebundenen Fassung zu Ende. Das ist das heutige Verhalten – es
wird hiermit zur Entscheidung und bekommt einen Test.

**2. Die Bindung ist an der Anforderung sichtbar.**
Die Antwort trägt Kennung, Fassungsnummer und Bezeichnung des Workflows, unter dem die
Anforderung läuft.

**3. Es gibt eine Auskunft, welche Fassungen in Gebrauch sind**, mit der Zahl der
Anforderungen je Fassung. Ohne sie ist nicht zu beurteilen, ob eine Änderung Folgen hat
oder ein Heben nötig ist.

**4. Eine laufende Anforderung kann auf die aktuelle Fassung gehoben werden** – als eigener
Verwaltungsvorgang, nicht als Nebenwirkung.

- Ziel ist **immer die aktuelle Fassung** desselben Workflows, nie eine beliebige
- Der aktuelle Zustand muss in der Zielfassung vorkommen, sonst wird abgewiesen
- Eine **Begründung ist Pflicht**
- Der Vorgang erzeugt eine neue Version und ist in der Historie als solcher gekennzeichnet
- Er verlangt `platform-admin`, wie die Zustandszuordnung

**5. Das Heben ändert den Zustand nicht.**
Es wechselt die Fassung, unter der künftige Übergänge geprüft werden – mehr nicht.

**6. Automatisches Heben findet nicht statt**, unter keinen Umständen.

## Begründung

**Zu 1 – warum aussprechen, was ohnehin geschieht.** Ein Verhalten, das nur aus dem Code
folgt, ändert sich beim nächsten Umbau unbemerkt. Hier ist es zusätzlich eine Weggabelung,
an der beide Richtungen plausibel klingen: „außer Kraft gesetzt" ließe sich auch als
„angehalten" lesen. Dass es das nicht heißt, gehört an eine Stelle, die man liest, und in
einen Test, der es festhält.

Sachlich spricht gegen das Einfrieren, dass `active = false` bereits ein Mittel gegen
Zulauf ist. Liefe zusätzlich alles Laufende auf, bräuchte es sofort einen Ausweg dafür –
mehr Maschinerie für einen Fall, den niemand verlangt hat.

**Zu 4 – warum heben überhaupt möglich sein muss.** Ohne diesen Vorgang ist ein Fehler in
einer Workflow-Definition für alles, was gerade läuft, **unbehebbar**. Vor M4.3 war das
verschmerzbar: Ein falscher Zustandsname fiel beim Speichern auf. Seit Bedingungen an
Übergängen hängen, kann eine Definition fachlich falsch und formal einwandfrei sein – eine
Rolle, die niemand hat, ein Vier-Augen-Bezug, der in der Praxis nicht erfüllbar ist. Dann
steht die Arbeit, und die neue Fassung erreicht sie nicht.

**Zu 4 – warum nur auf die aktuelle Fassung.** Ein Sprung auf eine beliebige
Zwischenfassung wäre eine Wahl, die niemand begründen kann, und er verwandelte das Heben in
eine Zeitreise. „Auf den heutigen Stand" ist die einzige Zielangabe, die sich in einem Satz
rechtfertigen lässt.

**Zu 4 – warum der Zustand vorkommen muss.** Sonst entstünde durch das Heben genau die Lage
aus ADR-0022 Punkt 5: eine Anforderung in einem Zustand, den ihr Graph nicht kennt. Das
wäre ein Vorgang, der ein Problem behebt und dabei ein anderes erzeugt. Ist der Zustand in
der Zielfassung nicht vorhanden, ist zuerst zuzuordnen.

**Zu 6 – warum nicht automatisch.** Automatisches Heben – etwa beim Außerkraftsetzen der
alten Fassung – änderte die Regeln unter einer laufenden Anforderung, ohne dass jemand es
angeordnet hat. Genau das schließt §7 aus, und es wäre besonders heikel, seit die Regeln
Genehmigungszuständigkeiten enthalten: Eine Anforderung, die unter einer Vier-Augen-Regel
begonnen hat, könnte ohne sie enden.

## Betrachtete Alternativen

### Gar nicht heben

Klarste Regel: Eine Anforderung beendet ihren Lauf unter der Fassung, unter der sie
begonnen hat. Nichts zu bauen.

**Nicht gewählt.** Ein Fehler in einer Definition wäre für alles Laufende endgültig. Der
einzige Ausweg – die Anforderungsart wechseln, damit ADR-0023 neu bindet – ist der
Missbrauch eines Vorgangs, der etwas anderes bedeutet, und er hinterlässt eine falsche
Spur in der Historie.

### Automatisch heben beim Außerkraftsetzen

Kein zusätzlicher Vorgang, keine Oberfläche, und veraltete Fassungen verschwinden von
selbst.

**Nicht gewählt**, siehe Begründung zu 6.

### Heben auf eine beliebige Fassung

Größere Freiheit, etwa um eine Anforderung gezielt auf eine bestimmte Zwischenfassung zu
setzen.

**Nicht gewählt.** Es gibt keinen Anwendungsfall, und die Wahl wäre nicht begründbar. Wer
sie später doch braucht, erweitert einen vorhandenen Vorgang – das ist einfacher, als eine
zu weite Freiheit wieder einzufangen.

### Außerkraftsetzen friert laufende Anforderungen ein

Ein Kennzeichen, eine Wirkung: Der Workflow gilt nicht mehr, für niemanden.

**Nicht gewählt.** Es ließe begonnene Arbeit liegen, ohne Ausweg, und verlangte sofort
einen weiteren Mechanismus, um sie wieder freizugeben.

## Konsequenzen

### Positiv

- Ein Fehler in einer Workflow-Definition ist behebbar, ohne die Bindung als Ganzes
  aufzugeben
- Die Zusicherung aus §7 bleibt: Es geschieht nichts von selbst, jede Änderung an einer
  laufenden Anforderung ist angeordnet, begründet und versioniert
- Ein Administrator kann vor einer Änderung sehen, was sie betrifft
- Das Verhalten bei Außerkraftsetzung ist entschieden statt geerbt

### Negativ und Risiken

- **Das Heben ist ein Werkzeug, mit dem sich die Bindung aushebeln lässt.** Wer alle
  laufenden Anforderungen hebt, hat der Sache nach rückwirkend geändert – nur eben
  ausdrücklich, begründet und nachvollziehbar. Die Sichtbarkeit aus Punkt 3 ist die
  Gegenmaßnahme: Massenhaftes Heben ist erkennbar
- **Es braucht `platform-admin`**, und diese Rolle sammelt weitere Befugnisse an. Sie ist
  ohnehin unter `PROD-017` als zu grob geführt
- **Eine gehobene Anforderung kann Bedingungen begegnen, die es beim Start nicht gab** –
  etwa einer neuen Pflichtangabe. Das ist gewollt, aber es kann sie kurzzeitig blockieren,
  bis die Angabe nachgetragen ist
- **Der neue Wert im Enum der Änderungsarten kostet eine Migration.** Klein, aber die
  Historie kennt danach eine Art, die ältere Auslesestellen nicht erwarten

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Aufbewahrung alter Workflow-Fassungen, die niemand mehr benutzt | mit `PROD-020` |
| Ob das Heben ein eigenes Recht statt `platform-admin` braucht | Meilenstein M5 |
| Darstellung der Fassung und des Hebens in der Verwaltungsoberfläche | Meilenstein M4.6 |
