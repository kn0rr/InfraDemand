# ADR-0018: Vollständigkeit und Löschung an der Importgrenze

- **Status:** Angenommen
- **Datum:** 2026-08-07
- **Betrifft:** CLAUDE.md §19.1, §19.2, §19.4
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Bei der Ausarbeitung von M3.4 zeigte sich, dass dem Requirement Service ein
Aktualisierungspfad fehlt: Eine wiederholte Übermittlung desselben Datensatzes endet mit
`409`. §19.1 verlangt das Gegenteil – *„Wiederholte Übermittlung desselben Datensatzes
erzeugt keine Dubletten. Bei Dateiimporten ist die Wiederholung der Normalfall."*

Beim Durchdenken des nächtlichen Imports trat eine zweite, größere Lücke zutage:

> Ein ziehender Import liefert, **was es gibt** – nicht, was es nicht mehr gibt. Wird eine
> Anforderung im Vorsystem gelöscht oder aus dem Umfang genommen, bleibt sie bei uns
> bestehen. Nichts an der Übermittlung erwähnt sie noch.

Das ist kein Randfall. Es trifft den Kern der Plattform: §19.4 begründet die vollständige
Versionierung mit **Nachweisfähigkeit** – belegen zu können, welchen Anforderungsbestand
das System zu einem Zeitpunkt kannte. Ein Bestand, der Anforderungen mitzählt, die im
führenden System längst gestrichen sind, belegt nichts. Die Kapazitätsplanung rechnet dann
mit Bedarf, den niemand mehr hat.

Die Frage ist deshalb nicht, ob wir Verschwinden behandeln, sondern **woran wir es
erkennen**.

## Entscheidung

**1. Jede Übermittlung erklärt ihren Umfang.**
Sie ist entweder **vollständig** oder **teilweise**. Die Angabe gehört zur Übermittlung,
nicht zur Konfiguration des Herkunftssystems: Dieselbe Quelle kann nachts vollständig und
stündlich teilweise liefern.

**2. Der erklärte Umfang ist benannt und begrenzt.**
Eine vollständige Übermittlung gilt immer *für ein Herkunftssystem*, optional weiter
eingegrenzt (etwa auf ein Projekt). Ohne benannten Umfang gibt es keine vollständige
Übermittlung.

**3. Bei „vollständig" bedeutet Abwesenheit fachliche Löschung** – innerhalb des erklärten
Umfangs und ausschließlich für Datensätze dieses Herkunftssystems. Was aus anderen Quellen
oder aus eigener Erfassung stammt, bleibt unberührt.

**4. Bei „teilweise" bedeutet Abwesenheit nichts.** Eine Löschung muss ausdrücklich
mitgeteilt werden.

**5. Der Vorgabewert ist „teilweise".**
Eine Übermittlung ohne Angabe löscht nichts. Die harmlosere Annahme gewinnt, wenn die
Absicht unklar ist.

**6. Die Einzelsatz-Schnittstelle ist immer „teilweise".**
Ein einzelner Datensatz sagt nichts über die übrigen aus. Vollständigkeit ist eine Aussage
über eine Menge und nur dort erklärbar, wo eine Menge übergeben wird.

**7. Eine Schutzschwelle bricht auffällige Löschmengen ab.**
Würde eine vollständige Übermittlung mehr als einen festgelegten Anteil des erklärten
Umfangs löschen, wird sie **abgewiesen statt ausgeführt** – mit einer Meldung, welche
Datensätze betroffen wären. Freigabe erfolgt durch eine ausdrückliche Bestätigung.

**8. Löschung ist fachlich, nicht physisch** ([ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md)
Punkt 6). Es entsteht eine Version mit entsprechender Kennzeichnung.

**9. Wiedererscheinen belebt wieder.**
Taucht ein zuvor gelöschter Datensatz in einer späteren Übermittlung erneut auf, entsteht
eine neue Version desselben Datensatzes – kein zweiter. Die Zuordnung läuft weiterhin über
Herkunftssystem und dortigen Bezeichner, und die sind unverändert.

**10. Ein gelöschter Datensatz bleibt in der Fachtabelle, gekennzeichnet.**
Er verschwindet aus dem aktuellen Bestand, aber nicht aus der Tabelle. Das ist nicht nur
eine Frage der Nachweisführung, sondern die Voraussetzung für Punkt 9: Die Verbindung
zwischen fremdem Bezeichner und unserer Kennung liegt in der Eindeutigkeit über
`source_system` und `external_id`. Wird die Zeile entfernt, ist die Kennung frei – und die
nächste Lieferung legt einen zweiten Datensatz an, statt den ersten wiederzubeleben.

**11. Umgesetzt wird mit dem Dateiimport, nicht jetzt.**
Diese Entscheidung legt die Bedeutung fest, damit der Vertrag sie von Anfang an trägt. Der
Mechanismus entsteht, wenn der Eingangsweg entsteht.

## Begründung

**Warum beides und nicht eines von beidem.** Es gibt zwei Arten von Vorsystemen, und keine
lässt sich auf die andere abbilden. Manche wissen von ihren Löschungen und können sie
melden; viele hören schlicht auf, die Zeile zu exportieren. Nur auf ausdrückliche
Löschsignale zu setzen hieße, den häufigeren Fall nicht zu behandeln. Nur auf
Vollständigkeit zu setzen hieße, inkrementelle Lieferungen unmöglich zu machen – oder
schlimmer: sie als vollständig misszuverstehen.

**Warum die Erklärung zur Übermittlung gehört und nicht zur Quelle.** Wäre sie am
Herkunftssystem konfiguriert, entschiede eine Einstellung von vor Monaten über die Wirkung
der heutigen Lieferung. Eine Quelle, die üblicherweise vollständig liefert, würde bei einer
ausnahmsweise gefilterten Lieferung den Rest löschen, ohne dass jemand etwas anderes getan
hätte als eine Datei hochzuladen.

**Warum Punkt 5 so und nicht umgekehrt.** Die beiden Fehlerfälle sind nicht gleich schwer.
Wird eine vollständige Lieferung versehentlich als teilweise behandelt, bleiben ein paar
Datensätze zu lange stehen – ärgerlich, sichtbar, korrigierbar. Umgekehrt löscht eine
teilweise Lieferung, die als vollständig gilt, den ganzen übrigen Bestand. Der Vorgabewert
gehört auf die Seite, deren Fehler man überlebt.

**Warum Punkt 7 trotz Punkt 5.** Auch eine ausdrücklich als vollständig erklärte Lieferung
kann falsch sein – ein gefilterter Export, ein abgebrochener Lauf, eine leere Datei. Der
Unterschied zwischen „SAP hat 3 Anforderungen gestrichen" und „SAP hat 4000 Anforderungen
gestrichen" ist nicht graduell, sondern der Unterschied zwischen einem Vorgang und einem
Unfall. Eine Schwelle, die den zweiten anhält, kostet im ersten Fall nichts.

**Warum Punkt 9 ausdrücklich festgehalten wird.** Ohne ihn wäre die naheliegende Umsetzung,
den gelöschten Datensatz zu übergehen und einen neuen anzulegen. Damit zerfiele die
Historie in zwei Stränge, und die Frage „wie hat sich diese Anforderung entwickelt" (§19.4,
§11) hätte zwei Antworten.

**Zu Punkt 10 – warum die Zeile bleiben muss und nicht nur die Historie.** ADR-0012 Punkt 2
sagt, die Fachtabelle führe ausschließlich den aktuellen Zustand. Daraus ließe sich
schließen, ein gelöschter Datensatz gehöre dort nicht mehr hin. Diese Auslegung
funktioniert nicht: Die Eindeutigkeit über `source_system` und `external_id` ist zugleich
die Zuordnung des fremden Bezeichners zu unserer Kennung. Sie liegt in der Fachtabelle,
nicht in der Historie – und sie muss über die Löschung hinweg bestehen bleiben, sonst ist
Punkt 9 nicht umsetzbar. „Gelöscht" ist deshalb ein Zustand des Datensatzes, kein
Verschwinden der Zeile.

Die Historie ist davon unberührt und war es nie: Die Stichtagsabfrage schließt Versionen
mit `operation = "delete"` aus, weshalb ein Datensatz für jeden Zeitpunkt **vor** seiner
Löschung weiterhin im Bestand erscheint. Ein Vergleich zweier Stichtage zeigt damit
unverändert, was dazwischen wegfiel.

## Betrachtete Alternativen

### Nur ausdrückliche Löschsignale

Das Vorsystem meldet Löschungen; Abwesenheit wird nie gedeutet.

Vorteile: keine Massenlöschung durch Missverständnis, inkrementelle Lieferung ist der
Normalfall, die Umsetzung ist deutlich einfacher.

**Nicht gewählt**, weil sie den häufigsten Fall nicht abdeckt. Ein Tabellenexport, aus dem
eine Zeile verschwindet, ist kein Löschsignal – und genau so sehen die meisten
Dateiimporte aus. Die Lücke bliebe bestehen und wäre nur nicht mehr benannt.

### Immer Vollabgleich

Jede Übermittlung gilt als vollständig für ihr Herkunftssystem.

Vorteile: eine Regel, keine Erklärung, kein Vorgabewert-Problem.

**Nicht gewählt.** Eine versehentlich gefilterte Lieferung löscht den Rest. Zudem wären
häufige kleine Aktualisierungen unmöglich, obwohl §19.2 die Schnittstelle als
gleichrangigen Eingangsweg führt – und dort ist die Einzelübermittlung der Normalfall.

### Abgleich über einen Zeitstempel des Vorsystems

Datensätze, die seit dem letzten Lauf nicht mehr bestätigt wurden, gelten als gelöscht.

**Nicht gewählt.** Das setzt voraus, dass jede Übermittlung wirklich jeden noch gültigen
Datensatz berührt – also faktisch Vollständigkeit, nur unausgesprochen und ohne die
Möglichkeit, sie zu prüfen. Ein ausgefallener Lauf löschte damit den gesamten Bestand.

## Konsequenzen

### Positiv

- Verschwundene Datensätze sind behandelbar, und zwar für beide Arten von Vorsystemen
- Die gefährliche Deutung verlangt eine ausdrückliche Erklärung; die harmlose ist der
  Vorgabewert
- Der Integrationsvertrag trägt die Unterscheidung von Anfang an – Punkt 10 verhindert,
  dass sie später als inkompatible Änderung nachgereicht werden muss
- Die Historie eines Datensatzes bleibt ein Strang, auch über Löschung und Wiederkehr

### Negativ

- **Die Schnittstelle wird umfangreicher.** Eine Übermittlung ist nicht mehr nur eine Liste
  von Datensätzen, sondern trägt eine Erklärung über sich selbst
- **Punkt 7 verlangt eine Schwelle, die jemand festlegen muss** – zu eng, und normale
  Bereinigungen werden blockiert; zu weit, und sie schützt nicht. Der Wert ist Konfiguration
  und braucht Betriebserfahrung
- **Die Bestätigung aus Punkt 7 ist ein Vorgang, den es noch nicht gibt.** Wer bestätigt,
  woran, und wie lange die Übermittlung dabei wartet, ist offen
- Der Vollabgleich ist der erste Vorgang der Plattform, der **viele Datensätze auf einmal**
  ändert. Versionierung nach ADR-0012 heißt hier: eine neue Version je gelöschtem Datensatz

### Offen

- **Höhe der Schutzschwelle** und ob sie als Anteil, als absolute Zahl oder als beides
  festgelegt wird – zu entscheiden mit der Umsetzung
- **Ablauf der Bestätigung** aus Punkt 7
- Ob die Erklärung des Umfangs auch für die **Schnittstelle** (nicht nur den Dateiimport)
  möglich sein soll – etwa für einen vollständigen Abgleich über die API
- **Wie sich gelöschte Datensätze auffinden lassen.** Die Stichtagsabfrage zeigt den
  Bestand *zu einem Zeitpunkt*; wer wissen will, *was seither wegfiel*, hat dafür keine
  Abfrage. Heute ginge es nur über den Vergleich zweier Stichtage von Hand. Für den
  Nachweis nach §19.4 und für die Darstellung über die Zeit (§11) wird das gebraucht
