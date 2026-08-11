# ADR-0020: Lebenszyklus der Infrastruktur – Maßnahme und abgeleiteter Bestandszustand

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §5, §7, §9, §17, §19.4
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Beim Zuschnitt von M4 – der Workflow-Engine nach §7 – kam die Frage auf, ob die
Zustandsmaschine auch die Infrastruktur bedienen soll. Racks und Server durchlaufen einen
Lebenszyklus, und aus der fachlichen Seite kamen drei Beispiele:

- **Hardwarerefresh**, bei dem aus zehn alten Racks drei neue werden – oder umgekehrt
- **Wartungsverlängerung**, ein eigener Vorgang mit Genehmigung
- **Außerbetriebnahme** zu einem geplanten Zeitpunkt

Das ist kein Randthema. Der Capacity Service hat nach §5 die Aufgabe, Auslastung und
Prognosen zu berechnen; seine Kernfrage lautet *„wie viel Kapazität steht im März 2028 zur
Verfügung"*. Diese Frage ist ohne den Lebenszyklus der Hardware nicht beantwortbar – ein
Rack, dessen Wartung in acht Monaten ausläuft, ist Kapazität, die verschwindet.

Die naheliegende Antwort wäre gewesen, den Zustandsgraphen aus §7 auf Racks anzuwenden.
Sie trägt nicht, und zwar aus drei Gründen, die sich nicht umgehen lassen:

- **Zeitgesteuerte Übergänge ohne Handelnden.** §7 beschreibt eine Maschine, die auf
  Handlungen reagiert – Berechtigung je Übergang, Vier-Augen-Prinzip. Ein Rack verlässt
  die Wartung, weil ein Datum vergeht. Es gibt niemanden, dessen Berechtigung zu prüfen
  wäre
- **Geplante künftige Zustände.** Die Versionierung nach
  [ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) beantwortet, was das System
  zu einem **vergangenen** Zeitpunkt wusste. Die Prognose fragt nach einem **künftigen**
  Zustand
- **Umwandlungen zwischen mehreren Objekten.** „Diese zehn enden, weil jene drei beginnen"
  ist kein Zustandswechsel eines Objekts, sondern eine Beziehung zwischen elfen

## Entscheidung

**1. Zwei Begriffe statt einem.**

| | Was es ist | Mechanismus |
|---|---|---|
| **Maßnahme** | Vorgang mit Genehmigung: Wartungsverlängerung, Refresh, Außerbetriebnahme, Beschaffung | Zustandsgraph nach §7 |
| **Bestandsobjekt** | Rack, Server, Netzwerkkomponente | **kein** Zustandsgraph |

**2. Das Bestandsobjekt führt keinen gespeicherten Zustand.**
Es trägt Datumsfelder. Sein Zustand zu einem Zeitpunkt ist eine **Auswertung** dieser
Felder – `Zustand = f(Daten, Zeitpunkt)`.

**3. Jedes Datum gibt es geplant und tatsächlich.**
Das geplante Wartungsende steht ab dem Vertrag fest, das tatsächliche entsteht, wenn die
Wirklichkeit eintritt. Damit ist die **Gültigkeitszeit** aus ADR-0012 Punkt 7 nicht mehr
vertagt, sondern für die Infrastruktur erforderlich.

**4. Die Maßnahme trägt den Workflow und die Beziehungen.**
Sie verweist auf **n Vorgänger** und **m Nachfolger**. Die Beziehung liegt an ihr, nicht
am Bestandsobjekt: Ein Rack kennt seinen Nachfolger nicht, die Maßnahme kennt beide.

**5. Eine genehmigte Maßnahme ändert die geplanten Daten sofort**, nicht erst zu ihrem
Wirksamkeitszeitpunkt. Die tatsächlichen Daten bleiben unberührt.

**6. Bestandsobjekte können als geplant existieren**, bevor es sie physisch gibt. Das
folgt aus Punkt 2: Ein Objekt mit ausschließlich geplantem Inbetriebnahmedatum ist heute
schlicht „geplant".

**7. Die Maßnahme liegt im Infrastructure Service.**

**8. Szenarien nach §9 sind Mengen angenommener Maßnahmen.**
„Was, wenn die Verlängerung nicht kommt" ist dieselbe Auswertung ohne diese Maßnahme;
„was, wenn wir zwei Racks früher beschaffen" dieselbe mit einer zusätzlichen. Kein eigener
Mechanismus.

**9. Umgesetzt wird mit M6 und M7, nicht jetzt.**
Diese Entscheidung legt die Begriffe fest. Was M4 davon berührt: Die Workflow-Maschine
bekommt einen zweiten Konsumenten, und ihre Prüf- und Übergangslogik bleibt deshalb frei
von NestJS und Datenbank – die spätere Herauslösung nach `packages/` ist dann ein
Verschieben von Dateien.

## Begründung

**Zu 2 – warum kein gespeicherter Zustand.** Ein gespeicherter Zustand kann seinen
eigenen Daten widersprechen: Ein Rack steht auf „in Betrieb", während sein
Außerbetriebnahmedatum in der Vergangenheit liegt. Solche Widersprüche entstehen
unweigerlich, sobald Daten und Zustand getrennt gepflegt werden, und sie fallen erst in
einer falschen Auswertung auf.

Entscheidend ist aber ein zweiter Punkt: Ein gespeicherter Zustand gilt **jetzt**. Er
lässt sich für keinen anderen Zeitpunkt abfragen. Eine Ableitung lässt sich für jeden
Zeitpunkt auswerten – auch für 2028. Genau darauf beruht die Prognose.

**Zu 3 – warum zwei Zeitachsen unvermeidlich sind.** Ohne die Unterscheidung geplant und
tatsächlich gibt es nur zwei schlechte Möglichkeiten: Entweder trägt man die Planung als
Wirklichkeit ein, dann behauptet der Bestand Dinge, die nicht eingetreten sind. Oder man
trägt sie nicht ein, dann sieht die Prognose sie nicht. Beides macht den Capacity Service
unbrauchbar.

**Zu 4 – warum die Beziehung an der Maßnahme hängt.** Läge sie am Rack – etwa als Feld
„ersetzt durch" –, müsste bei einer Konsolidierung jedes der zehn alten Racks auf drei
neue verweisen. Die Beziehung wäre dreißigfach gespeichert und könnte in dreißig Teilen
auseinanderlaufen. An der Maßnahme steht sie einmal.

**Zu 5 – warum sofort und nicht zum Wirksamkeitszeitpunkt.** Der Zweck der Planung ist,
dass die Prognose sie kennt. Eine genehmigte Verlängerung, die erst in zwei Jahren in die
Zahlen einfließt, ist für die Kapazitätsplanung wertlos – dort wird sie **heute**
gebraucht, um zu entscheiden, ob beschafft werden muss.

**Zu 7 – warum Infrastructure und nicht Requirement.** Die Maßnahme ändert Daten des
Infrastructure Service. Läge sie im Requirement Service, müsste eine Genehmigung dort über
die Servicegrenze hinweg in fremde Daten schreiben – genau die Kopplung, die
[ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md) an anderer Stelle ausschließt,
und ein Verstoß gegen die erste Regel aus
[services.md](../architecture/services.md): ein Service besitzt seine Daten allein.

Das Gegenargument – alle Genehmigungen an einem Ort – wäre gewichtig gewesen, wenn
derselbe Personenkreis Bestellungen und Wartungsverlängerungen genehmigte. Er tut es
nicht; es sind getrennte Kreise. Damit entfällt der Vorteil, und die Datenhoheit
entscheidet.

**Zu 8 – warum das mehr ist als eine Umformulierung.** §9 nennt Was-wäre-wenn-Szenarien,
ohne zu sagen, woraus sie bestehen. Ohne diesen Satz wäre ein Szenario ein eigenes
Datenmodell mit eigener Pflege. Als Menge angenommener Maßnahmen ist es eine Auswahl über
vorhandenen Daten – und jedes Szenario ist genau so belastbar wie die Maßnahmen, aus denen
es besteht.

## Betrachtete Alternativen

### Zustandsmaschine am Bestandsobjekt

Racks und Server bekommen einen Zustandsgraphen nach §7, wie Anforderungen.

Vorteile: ein Mechanismus für alles, keine neuen Begriffe, unmittelbar mit M4 nutzbar.

**Nicht gewählt.** Sie kann keinen der drei Fälle abbilden: nicht den zeitgesteuerten
Übergang ohne Handelnden, nicht den künftigen Zustand, nicht die Umwandlung mehrerer
Objekte. Der dritte Fall ist der endgültige – zehn Objekte, die gemeinsam den Zustand
wechseln, weil drei andere entstehen, sind keine Zustandsmaschine, gleich wie man sie
biegt. Aufgefallen wäre es spätestens beim ersten Refresh, und dann wäre das Modell
bereits in Gebrauch.

### Maßnahme im Requirement Service

Wie die Bestellung nach §18: Der Vorgang liegt im Requirement Service, andere Dienste
reagieren.

Vorteile: alle Genehmigungen an einem Ort, eine Oberfläche, ein Auditpfad, und die
Workflow-Maschine bleibt in einem Dienst.

**Nicht gewählt**, weil die Genehmigung über die Servicegrenze in fremde Daten schreiben
müsste und die Genehmigenden ohnehin getrennte Kreise sind. Die Analogie zur Bestellung
trägt nicht: Eine Bestellung ist ein **Bedarf**, den jemand anmeldet; eine
Wartungsverlängerung ist eine **Betriebsentscheidung** über vorhandenen Bestand.

### Datumsfelder ohne Maßnahmenbegriff ändern

Wer das Recht hat, ändert das geplante Wartungsende unmittelbar am Rack.

Vorteile: kein zusätzliches Datenmodell, kein Workflow, sofort umsetzbar.

**Nicht gewählt.** Es gäbe keine Genehmigung, keinen nachvollziehbaren Grund für die
Änderung und keine Möglichkeit, mehrere Objekte gemeinsam zu behandeln. Vor allem aber
gäbe es keine Szenarien: Punkt 8 setzt voraus, dass eine Absicht als eigenes Objekt
existiert, bevor sie wirkt.

## Konsequenzen

### Positiv

- Der Zustand eines Bestandsobjekts ist für **jeden** Zeitpunkt auswertbar, vergangen wie
  künftig, und kann seinen eigenen Daten nicht widersprechen
- Umwandlungen mit mehreren Vorgängern und Nachfolgern sind natürlich abbildbar
- §9 bekommt eine Form, ohne dass ein eigenes Szenariomodell entsteht
- Der Workflow aus §7 wird wiederverwendet, wo er passt – bei der Maßnahme – und nicht
  gedehnt, wo er nicht passt

### Negativ

- **Die Gültigkeitszeit ist damit Pflicht**, nicht mehr optional. ADR-0012 Punkt 7 hatte
  sie vertagt; sie wird vor M6 fällig, und sie betrifft das Datenmodell des Infrastructure
  Service von Beginn an
- **Der Infrastructure Service braucht die Workflow-Maschine.** Damit wird die Frage nach
  einem geteilten Paket unter `packages/` fällig – sie ist im Verzeichnis der vertagten
  Entscheidungen geführt
- **Genehmigungen liegen in zwei Diensten.** Wer einen Gesamtüberblick über offene
  Genehmigungen will, braucht eine Ansicht, die beide abfragt. Das ist der Preis der
  Datenhoheit und mit getrennten Kreisen tragbar – bei einem gemeinsamen Kreis wäre die
  Entscheidung anders ausgefallen
- **Abgeleitete Zustände sind teurer als gespeicherte.** Eine Bestandsabfrage über
  zehntausend Racks zu einem Stichtag wertet zehntausend Datumsvergleiche aus. Für
  Auswertungen nach §10 und §11 wird ein Lesemodell nötig – dieselbe Frage, die ADR-0012
  für Stichtagsabfragen bereits offen führt

### Offen

- **Welche Datumsfelder ein Bestandsobjekt trägt** und wie der Zustand daraus abgeleitet
  wird – die Zustandsnamen selbst sind Fachdaten oder Code, das ist noch nicht entschieden
- **Ob eine Maßnahme ihre Wirkung zurücknehmen kann**, nachdem sie genehmigt wurde, und
  was das für bereits gerechnete Prognosen bedeutet
- **Wie Szenarien nach Punkt 8 gespeichert werden** – als Auswahl von Maßnahmen oder als
  eigene, nicht genehmigte Maßnahmen in einem Szenariokontext
