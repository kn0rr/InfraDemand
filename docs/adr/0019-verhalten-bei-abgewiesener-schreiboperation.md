# ADR-0019: Verhalten bei abgewiesener Schreiboperation

- **Status:** Angenommen
- **Datum:** 2026-08-07
- **Betrifft:** CLAUDE.md §16, §19.2, §19.3
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0011](0011-datenhoheit-je-feld-und-kontext.md) und
[ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) stellen dieselbe
Frage bis M3 zurück:

> Verhalten bei Abweisung: Fehler, stilles Verwerfen oder Vormerken zur Klärung

Mit M3.4c wird sie fällig. Die Hoheitsregeln aus ADR-0017 A2 weisen Schreiboperationen auf
einzelne Felder ab; die Festhaltung aus Teil B tut dasselbe in die andere Richtung. In
beiden Fällen trifft eine Schreiboperation auf ein Feld, das sie nicht setzen darf – und
es ist zu entscheiden, was mit den **übrigen** Feldern derselben Operation geschieht.

## Entscheidung

**1. Eine abgewiesene manuelle Schreiboperation lässt die gesamte Anfrage scheitern.**
Kein Feld wird übernommen, auch keines, das zulässig gewesen wäre. Die Antwort benennt
feldbezogen, was abgewiesen wurde und warum.

**2. Eine abgewiesene automatische Schreiboperation wird verzeichnet; die übrigen Felder
werden übernommen.** Der Vorgang gilt als erfolgreich.

**3. Beide Fälle werden nach ADR-0017 B10 aufgezeichnet** – mit Zeitpunkt, Feld, Quelle
und dem abgewiesenen Wert.

**4. Aufgezeichnet wird nur, was einen bestehenden Datensatz betrifft.**
Scheitert die *Anlage* eines Datensatzes an einer Regel, entsteht kein Eintrag: Es gibt
keinen Wert, bei dem wir geblieben wären, und der Aufrufer erfährt es unmittelbar.

**5. „Vormerken zur Klärung" wird nicht eingeführt.**

## Begründung

**Das Unterscheidungsmerkmal ist, ob jemand anwesend ist.** Ein Mensch im Formular
bekommt eine Fehlermeldung und kann sie beantworten – er korrigiert die Eingabe oder
erfährt, dass dieses Feld nicht ihm gehört. Genau das ist der Nutzen, den ADR-0017 dem
Regelwerk zuschreibt: dass die Rückmeldung *sofort* kommt statt eine Woche später.

Ein nächtlicher Lauf hat niemanden, dem er es sagen könnte. Ließe man ihn wegen eines
einzigen festgehaltenen Feldes scheitern, blieben alle übrigen Änderungen desselben
Datensatzes aus – und der Fehler zeigt sich als veralteter Bestand, nicht als Meldung. Das
ist die schlechtere Wirkung.

**Warum bei Punkt 1 alles scheitert und nicht nur das eine Feld.** Ein Formular, das die
zulässigen Felder übernimmt und die übrigen verwirft, hinterlässt einen Zustand, den
niemand beabsichtigt hat: teils alt, teils neu. Der Anwender sieht eine Erfolgsmeldung und
später einen Datensatz, der weder seinem Entwurf noch dem vorherigen Stand entspricht.
Alles-oder-nichts ist bei einer Eingabe, die jemand gerade abgeschickt hat, die einzige
Fassung, die man erklären kann.

**Warum Punkt 2 nicht dasselbe Argument trifft.** Ein Import überträgt keinen Entwurf
eines Menschen, sondern den Stand eines Fremdsystems. Dass wir davon einen Teil nicht
übernehmen, ist kein Bruch einer Absicht, sondern genau der Zweck einer Festhaltung.

**Warum kein Vormerken.** Ein Klärungsvorrat ist ein eigener Zustand mit eigener
Lebensdauer, eigener Zuständigkeit und der Frage, was gilt, solange nichts geklärt ist.
Er wäre ein drittes Datenmodell neben Fachdaten und Historie – und ohne einen Vorgang, der
ihn abarbeitet, ein Speicher, in den niemand sieht. Falls der Bedarf entsteht, ist die
Aufzeichnung aus Punkt 3 seine Grundlage.

## Betrachtete Alternativen

### Einheitlich scheitern lassen

Auch der Import scheitert, wenn ein Feld abgewiesen wird.

Vorteile: eine Regel, keine Fallunterscheidung, jede Abweisung ist sichtbar.

**Nicht gewählt.** Ein festgehaltenes Feld würde jede weitere Aktualisierung des
Datensatzes verhindern – die Festhaltung eines einzigen Wertes fröre den ganzen Datensatz
ein. Das ist das Gegenteil dessen, was ADR-0017 B6 beabsichtigt: den Einzelfall zu regeln,
ohne den Regelfall zu ändern.

### Einheitlich verwerfen

Auch die manuelle Eingabe übernimmt, was zulässig ist, und verwirft den Rest still.

Vorteile: kein Vorgang scheitert je, einfachere Aufrufer.

**Nicht gewählt.** Der Anwender bekäme eine Erfolgsmeldung für etwas, das nur teilweise
geschah. Der Fall aus dem einleitenden Beispiel von ADR-0017 – jemand ändert einen Wert
und erfährt erst Tage später, dass es wirkungslos war – wäre damit nicht behoben, sondern
nur verlagert.

### Vormerken zur Klärung

**Nicht gewählt**, siehe Begründung.

## Konsequenzen

### Positiv

- Wer eine Eingabe abschickt, bekommt eine Antwort, die zu dem passt, was tatsächlich
  gespeichert wurde
- Ein festgehaltenes Feld blockiert keine Aktualisierung der übrigen
- Beide Richtungen sind nachweisbar, weil beide aufgezeichnet werden

### Negativ

- **Zwei Verhaltensweisen statt einer.** Wer den Schreibpfad liest, muss die
  Unterscheidung kennen; sie steht deshalb im Code an der Verzweigung, nicht nur hier
- **Punkt 2 macht Abweisungen leise.** Ein Import meldet Erfolg, obwohl er einen Teil
  nicht durchbrachte. Ohne die Übersicht aus ADR-0017 B14 fiele das niemandem auf – sie
  ist damit nicht Zubehör, sondern Bedingung
- **Punkt 1 verwirft auch gültige Änderungen.** Wer zehn Felder ändert und bei einem
  danebenliegt, bekommt nichts gespeichert. Das ist gewollt, aber es verlangt von der
  Oberfläche, alle beanstandeten Felder auf einmal zu zeigen – sonst wird daraus ein
  Ratespiel über mehrere Anläufe

### Offen

- Ob ein Import eine **Zusammenfassung** seiner Abweisungen zurückbekommen sollte – heute
  erfährt er nur, dass der Vorgang erfolgreich war. Zu entscheiden mit dem Dateiimport
  ([ADR-0018](0018-vollstaendigkeit-und-loeschung-an-der-importgrenze.md))
