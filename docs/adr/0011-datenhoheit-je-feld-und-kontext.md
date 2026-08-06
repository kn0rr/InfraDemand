# ADR-0011: Datenhoheit je Feld und Kontext

- **Status:** Angenommen
- **Datum:** 2026-08-05
- **Betrifft:** CLAUDE.md §6, §8, §16, §17
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Ergänzung der fachlichen Vorgabe vom 2026-08-05, aufbauend auf
[ADR-0010](0010-entkopplung-anforderung-und-kapazitaet.md):

> Ergänzt können auch manuelle Einträge sein im Webfrontend. Führende Daten pro Kontext
> und bis auf Datenfeld einstellbar sein.

Damit gibt es **drei gleichwertige Eingangswege** – Schnittstelle, Dateiimport und
manuelle Erfassung – und eine Anforderung, die über die bereits vorhandenen Regeln
hinausgeht.

§6 kennt bislang je Attribut die Merkmale „API-beschreibbar" und „API-überschreibbar",
§16 eine konfigurierbare Konfliktregel bei gleichzeitiger UI- und API-Pflege. Beide
beantworten die Frage *„darf diese Quelle schreiben?"*.

Die neue Vorgabe beantwortet eine andere Frage: *„welche Quelle ist für dieses Feld die
maßgebliche?"* – und zwar **je Feld und je Kontext** konfigurierbar. Das ist Datenhoheit
(Mastership), nicht Schreibberechtigung. Ein Feld kann für eine Quelle beschreibbar sein,
ohne dass diese Quelle dafür führend ist.

## Entscheidung

**1. Drei gleichwertige Eingangswege.**
Schnittstelle, Dateiimport und manuelle Erfassung im Webfrontend sind gleichrangig. Alle
drei durchlaufen dieselbe Validierung und denselben Verarbeitungspfad; sie unterscheiden
sich ausschließlich in Transport und Herkunftsangabe.

**2. Jede Schreiboperation führt ihre Quelle mit – als fachliche Eingabe, nicht nur als
Protokollangabe.**
Die Herkunft ist bereits nach §16 zu auditieren. Sie wird zusätzlich zur Eingabe der
Entscheidung, *ob* ein Wert überschrieben werden darf.

**3. Datenhoheit ist je Feld und je Kontext konfigurierbar** und wird wie die
Attributdefinitionen aus §6 als **Fachdaten** geführt – nicht als Code, ohne Redeploy
änderbar, versioniert.

**4. Der Auditpfad ist feldgenau, nicht datensatzgenau – ab der ersten
Schreiboperation.**
Je geändertem Feld müssen alter Wert, neuer Wert und Quelle rekonstruierbar sein. Das ist
die Voraussetzung dafür, dass sich die Feldherkunft jederzeit ermitteln lässt.

> **Nachtrag 2026-08-05 – Umsetzung durch ADR-0012.**
> Die am selben Tag getroffene Entscheidung
> [ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) erfüllt diesen Punkt,
> **ohne** feldgenaue Auditeinträge zu speichern: Aus dem Vergleich zweier
> aufeinanderfolgender vollständiger Versionen ergeben sich alter Wert, neuer Wert und –
> da jede Version genau eine Quelle trägt – auch die feldgenaue Herkunft.
>
> Die Anforderung bleibt unverändert, der Mechanismus ist ein anderer und einfacher als
> hier ursprünglich angenommen. Es entsteht **ein** Speicher, nicht zwei.

**5. Die Hoheitsregeln selbst werden erst mit dem dynamischen Attributmodell umgesetzt**
(M3). Bis dahin gilt der globale Vorgabewert aus §6 und §16: Überschreiben ist erlaubt.

## Begründung

**Punkt 4 ist der einzige zeitkritische.** Alles Übrige lässt sich nachrüsten, solange die
Feldherkunft rekonstruierbar bleibt. Ist der Auditpfad datensatzgenau, ist sie es nicht –
dann steht nur fest, dass ein Datensatz geändert wurde, nicht welches Feld von welcher
Quelle. Diese Information ist danach unwiederbringlich verloren.

**Punkt 5 verhindert verfrühte Festlegung.** Die Hoheitsregeln gehören fachlich zu den
Attributdefinitionen: Beide beschreiben Eigenschaften eines Feldes in einem Kontext, beide
sind versionierte Fachdaten, beide werden über dieselbe Administrationsoberfläche
gepflegt. Sie vorher separat zu bauen hieße, dieselbe Struktur zweimal zu entwerfen.

**Zu Punkt 2 – warum die Herkunft mehr ist als ein Protokolleintrag.** Wird sie nur
auditiert, steht sie erst *nach* der Entscheidung fest. Für „die führende Quelle gewinnt"
muss sie *vor* der Entscheidung vorliegen und die Schreiboperation beeinflussen. Das
verschiebt sie vom Rand in den Kern des Schreibpfads.

## Konsequenzen

### Positiv

- Die Feldherkunft bleibt ab der ersten Schreiboperation rekonstruierbar, auch bevor das
  Hoheitsmodell existiert.
- Manuelle Erfassung ist kein Sonderfall neben den maschinellen Wegen, sondern ein
  gleichrangiger Eingang – dieselbe Validierung, dieselbe Auditierung.
- Die Hoheitsregeln entstehen dort, wo sie fachlich hingehören, statt vorab an anderer
  Stelle.

### Negativ und Risiken

- **Feldgenaues Auditieren erzeugt deutlich mehr Datensätze** als datensatzgenaues. Bei
  Massenimporten ist das mengenrelevant und braucht ein Aufbewahrungskonzept
  (siehe PROD-020).
- **Die Herkunft wird zu einem Pflichtbestandteil jeder Schreiboperation.** Ein Aufruf
  ohne belastbare Herkunftsangabe darf nicht schreiben dürfen. Das betrifft auch interne
  Aufrufe und Migrationen.
- **Wachsende Konfigurationsfläche.** Attributdefinition, Schreibberechtigung,
  Überschreibregel und Datenhoheit sind vier Merkmale je Feld und Kontext. Ohne eine
  verständliche Administrationsoberfläche wird das nicht beherrschbar – das ist eine
  Anforderung an M3, kein Nebenaspekt.
- **Konflikte werden sichtbar, nicht seltener.** Zwei Quellen, die dasselbe Feld
  beanspruchen, sind ein fachliches Problem. Das Modell macht es erkennbar; lösen muss es
  die Fachseite.

## Offene Frage: Was ist ein „Kontext"?

Die Vorgabe nennt Datenhoheit „pro Kontext". Der Begriff ist noch nicht festgelegt.
Naheliegende Kandidaten, die im Anforderungsdokument bereits als Dimensionen existieren:

| Kandidat | Fundstelle | Anmerkung |
|---|---|---|
| Anforderungstyp / Projektkategorie | §6 | Attributdefinitionen sind bereits so aufgeteilt – die naheliegendste Wahl |
| Bereitstellungskategorie | §17 | Cloud, Legacy, Hybrid, KI – hat bereits eigene Pflichtattribute |
| Projekt oder Organisation | §8 | Mandantenfähigkeit und Scoping |
| Herkunftssystem | ADR-0010 | „In Kontext A ist SAP führend, in Kontext B die manuelle Erfassung" |

**Bis zur Klärung wird angenommen: Kontext entspricht der Dimension aus §6**, also
Anforderungstyp beziehungsweise Projektkategorie. Diese Annahme ist vor Beginn von M3 zu
bestätigen oder zu korrigieren; sie beeinflusst den Zuschnitt der Attributdefinitionen und
damit deren Datenmodell.

Für M1.4 ist die Frage ohne Auswirkung.

> **Beantwortet am 2026-08-06 durch
> [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) – die Annahme
> wird korrigiert, nicht bestätigt.**
>
> Die Frage nach dem Geltungsbereich stellt sich nicht mehr, weil sich die Formulierung
> der Regel geändert hat. Eine Hoheitsregel benennt **kein konkretes System** („für `owner`
> ist SAP führend"), sondern eine **Quellenklasse** („für `owner` hat der automatische
> Ladevorgang Vorrang"). Die relative Formulierung wirkt genau dort, wo eine automatische
> Quelle das Feld tatsächlich bespielt, und ist damit selbstbegrenzend – ein Mandant ohne
> Vorsystem ist von der Regel unberührt, ohne dass die Konfiguration ihn nennen müsste.
>
> **Die Antwort auf „was ist ein Kontext" lautet daher: keiner.** Eine Regel gilt je Feld
> für alle Anforderungen. Eine leer bleibende Bindungsspalte hält den Weg zu einem
> Geltungsbereich offen, falls der eine Fall eintritt, den dieses Modell nicht abbildet –
> zwei Mandanten mit je eigenem Vorsystem und unterschiedlichem Vertrauen darin.
>
> Zugleich beantwortet ADR-0017 die hier unter *Folgeentscheidungen* für M3 vorgesehene
> Frage nach dem **Regelvokabular** – drei Werte: `manuell erlaubt`,
> `Automatik hat Vorrang`, `manuell gesperrt` – und ergänzt zwei Ausnahmen je Datensatz,
> die in diesem ADR noch nicht vorgesehen waren: die administrative Einzelübernahme und
> das Festhalten eines Feldes gegen automatische Übernahme.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Feldgenaues Audit-Ereignisschema | ~~M1.4~~ – erledigt, Mechanismus siehe Nachtrag oben |
| ~~Bedeutung von „Kontext"~~ | beantwortet durch [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A5: keiner |
| ~~Regelvokabular der Datenhoheit~~ | festgelegt durch [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A2 |
| Speicherung der Feldherkunft: eigenes Feld oder Ableitung aus dem Auditpfad | M3 |
| Verhalten bei Konflikt: Ablehnen, Verwerfen oder Vormerken zur Klärung | M3 |
| ~~Manuelle Erfassung im Webfrontend~~ | umgesetzt in M2.5 |
