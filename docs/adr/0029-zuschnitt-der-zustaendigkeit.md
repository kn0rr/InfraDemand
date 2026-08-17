# ADR-0029: Zuschnitt der Zuständigkeit und Grenzen des Objektbezugs

- **Status:** Angenommen
- **Datum:** 2026-08-14
- **Betrifft:** CLAUDE.md §6, §8, §15
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0028](0028-policy-engine-opa-als-sidecar.md) hat mit M5.2 den Rahmen geliefert: OPA als
Sidecar, eine Richtlinie, die Übersetzung nach Drizzle und den Nachweis, dass die erzeugte
Bedingung dieselbe Menge liefert wie der Filter aus M5.1. Die Engine ist angebunden und
entscheidet nichts (`PROD-059`).

M5.3 soll den Objektbezug bringen. Die Architekturdokumentation nennt als Beweisziel: *„Die
Rolle am Workflow-Übergang gilt nicht mehr überall"* – also die Auflösung von `PROD-017`,
des Eintrags, der einen Produktivgang ausschließt.

### Was §8 verlangt und was das Datenmodell hergibt

§8 nennt als Zuschnittsdimensionen Projekt, Organisation, Region und Kostenstelle. Auf
`requirement` vorhanden sind:

| Dimension | Stand |
|---|---|
| Mandant | `tenant`, Kernspalte, wird seit M5.1 gefiltert |
| Eigentümer | `owner`, Kernspalte |
| Projekt | `project_id` – eine nackte Kennung, **ohne Entität**; es gibt keine Projekttabelle |
| Organisation, Region, Kostenstelle | existieren nicht |

### Drei geprüfte Randbedingungen

**Das Regelfragment erlaubt unter der Unbekannten genau eine Ebene.**
`input.requirement.tenant` wird übersetzt, `input.requirement.dynamic_attributes.kostenstelle`
nicht – mit und ohne zusätzliche Deklaration der Unbekannten (siehe Nachweise).

**Verknüpfte Bedingungen erzeugen `compound`-Knoten.** Zwei Bedingungen ergeben ein `and`,
zwei Regelkörper ein `or`, verschachtelt.

**Die Größe des Sitzungscookies ist gemessen.** `PROD-045`: rund 1000 Byte Spielraum, etwa
48 Byte je zusätzlichem Anspruch.

## Entscheidung

**1. Ein Merkmal, nach dem Berechtigungen zugeschnitten werden, muss eine Kernspalte sein.**
Als dynamisches Attribut ist es nicht zuschneidbar. Das folgt aus dem Regelfragment und ist
keine Wahl – es wird hier festgehalten, damit es niemand als Fehler sucht.

**2. M5.3 schneidet nach Mandant und Eigentümer zu.** Kein Projekt, keine Kostenstelle,
keine Region.

**3. Es entsteht keine Zuordnung von Personen zu Bereichen im Requirement Service** – weder
als Tabelle noch als zusätzlicher Anspruch im Token.

**4. Der Lesezuschnitt geht auf die Engine über.** Der handgeschriebene Filter aus M5.1
entfällt; `findAll` fragt die Richtlinie. Damit schließt `PROD-059`.

**5. `PROD-017` schließt nicht mit M5.3.** Die Zuständigkeit je Bereich und Person hat keine
Quelle vor dem Identity & Access Service; der Eintrag wird auf M6 datiert und erhält dort
eine Begründung statt eines Teilzuschnitts.

**6. Die Rollenprüfungen an den Endpunkten bleiben, wo sie sind.** Über ihren Umzug wird mit
M5.4 entschieden.

**7. Vorbedingung: die beiden ausstehenden Maßnahmen aus `PROD-058`** – Bindung des
Sidecars an die Rückschleife und ein gemeinsames Merkmal zwischen Dienst und Sidecar – sind
**vor** der Umstellung zu treffen, nicht mit ihr.

## Begründung

**Zu 1 – warum das keine Nebenbemerkung ist.** §6 macht das Datenmodell zum Fachdatum: Ein
Administrator legt Attribute ohne Redeploy an. §8 will nach fachlichen Merkmalen
zuschneiden. Beides zusammen legt nahe, ein neu angelegtes Attribut lasse sich für den
Zuschnitt verwenden. **Das geht nicht**, und der Versuch endet nicht in einer Fehlermeldung
mit Hinweis, sondern in `pe_fragment_error: invalid ref operand`. Wer diese Grenze nicht
dokumentiert, lässt sie jemanden entdecken.

Die Feldebene ist davon **nicht** betroffen: Maskierung entscheidet über die Ausgabe einer
bereits ausgewählten Zeile und braucht keine partielle Auswertung. Ein dynamisches Attribut
lässt sich also rollenabhängig verbergen, auch wenn es keine Zeilen zuschneiden kann.

**Zu 2 und 3 – warum aus dem Datensatz und nicht aus einer Zuordnung.** `owner` ist bereits
Kernspalte, die Kennung steht bereits im Token, und `compound` trägt die Verknüpfung. Damit
entsteht Objektbezug ohne neue Fachdaten und ohne neue Identitätsmechanik – „meine
Anforderungen, und als Freigeber alle im Mandanten".

Gegen Ansprüche im Token spricht eine gemessene Grenze, nicht eine Vermutung: Bei rund
48 Byte je Anspruch und 1000 Byte Spielraum trägt es für eine Handvoll Projekte und für
zwanzig nicht. Gegen eine eigene Zuordnungstabelle spricht §5 – Identitätsfachlichkeit
gehört in den Identity & Access Service, und was hier entstünde, müsste M6 zurückbauen.

Nach `project_id` zuzuschneiden hilft nicht: Die Spalte existiert, aber die Frage „welche
Projekte gehören diesem Anwender" hat keine Antwort ohne genau die Zuordnung, die Punkt 3
ausschließt.

**Zu 5 – warum eine offene Begründung besser ist als ein Teilzuschnitt.** Ein Zuschnitt nach
Eigentümer sieht aus wie gelöste Objektberechtigung, lässt die Freigaberolle aber global.
`PROD-017` beschreibt genau diese Erscheinungsform bereits an zwei anderen Stellen. Ihn mit
einem Teilergebnis zu schließen, hieße den Eintrag zu bestätigen statt ihn aufzulösen.

**Zu 6 – warum kein Umzug ohne Anlass.** Guard und Engine beantworten verschiedene Fragen:
„darf diese Identität diesen Vorgang aufrufen" gegen „welche Zeilen und Felder bekommt sie".
Ein Umzug jetzt hätte drei Nachteile ohne fachlichen Gewinn: Die Ausfallwirkung des Sidecars
wüchse von „gefilterte Listen hängen" auf „jede Anfrage hängt"; die Rollenprüfungen
verlören ihre Abdeckung in den schnellen Tests; und jeder Fehler dabei wäre ein
Sicherheitsfehler. Der sachliche Auslöser tritt mit M5.4 ein, wenn aus der Endpunktfrage ein
„an diesem Objekt" wird.

**Zu 7 – warum vorher.** Solange die Guards danebenstehen, wäre eine über die
Verwaltungsschnittstelle ausgetauschte Richtlinie eine von zwei Prüfungen. Ab Punkt 4 ist
sie die einzige. `PROD-058` nennt als Frist ausdrücklich, was zuerst eintritt – die
gemeinsam genutzte Umgebung oder der Moment, in dem die Engine alleine trägt.

## Betrachtete Alternativen

### Projektzugehörigkeit als Anspruch im Token

Ein zweiter Anspruch neben `tenants`, dieselbe Mechanik.

**Nicht gewählt.** Die Grenze ist gemessen (`PROD-045`), und ADR-0026 Punkt 6 hat die Frage
nach der Herkunft von Zugehörigkeiten bereits auf M6 vertagt. Es entstünde ein Mechanismus,
den M6 ersetzt, zulasten des verbleibenden Spielraums.

### Zuordnungstabelle im Requirement Service

Personen, Bereiche und Zuständigkeiten als Fachdaten in diesem Dienst.

**Nicht gewählt.** Unbegrenzt skalierbar und sofort verfügbar, aber am falschen Ort (§5).
Bis M6 gäbe es zwei Stellen, an denen Zugehörigkeit steht, und die zweite müsste
zurückgebaut werden.

### Kostenstelle als neue Kernspalte

Näher an §8, und nach Punkt 1 der einzige Weg, nach ihr zuzuschneiden.

**Nicht gewählt.** Eine fachliche Dimension würde ins Schema eingefroren und wäre nicht mehr
über die Verwaltungsoberfläche pflegbar – und gespeist werden könnte der Zuschnitt trotzdem
nicht, weil die Zuordnung von Personen zu Kostenstellen fehlt. Es entstünde eine Spalte ohne
Entität, wie `project_id` heute.

### M5.3 hinter M6 ziehen

Den Objektbezug erst bauen, wenn es eine Quelle für Zuständigkeit gibt.

**Nicht gewählt.** Es wäre folgerichtig, ließe aber `PROD-059` bis dahin offen: eine
Engine, die in jeder Umgebung läuft, konfiguriert werden muss und nichts entscheidet. Der
kleinere Zuschnitt bringt die Engine in Gebrauch, und das ist der Zustand, in dem Fehler
auffallen.

## Konsequenzen

### Positiv

- Die Engine wirkt und wird bei jedem Lesevorgang benutzt; `PROD-059` schließt
- Objektbezug ohne neue Fachdaten, ohne zweiten Ort für Zugehörigkeit, ohne Vorgriff auf M6
- Die Grenze aus Punkt 1 ist festgehalten, bevor jemand sie sucht
- Ein Ausfall des Sidecars trifft weiterhin nur den Lesezuschnitt, nicht jede Anfrage

### Negativ und Risiken

- **Der Meilenstein liefert sein ursprüngliches Beweisziel nicht.** Die Freigaberolle bleibt
  global. Das ist ausgeschrieben und nicht stillschweigend verkleinert – aber wer nur die
  Meilensteintabelle liest, könnte es übersehen
- **Ein Zuschnitt nach Eigentümer kann für Objektberechtigung gehalten werden.** Er ist
  einer, aber der schwächste denkbare. `PROD-017` bleibt die Stelle, an der das steht
- **Die Übersetzung wird komplexer.** `compound` verlangt Rekursion über `and` und `or`;
  jede Form braucht einen Test. Ein nicht behandelter Knoten muss weiterhin werfen und darf
  nicht weggelassen werden – eine übersprungene Bedingung öffnet den Bestand
- **Die Stichtagsabfrage liest eine andere Tabelle.** Die Feldnamen der Richtlinie sind an
  die Tabelle gebunden; `findAsOf` braucht eine eigene Regel oder eine Umschreibung auf
  `requirement_history`
- **Die Feldebene hat im Upstream keine Entsprechung.** Masken liefert nur Enterprise OPA;
  M5.4 baut die Projektion selbst

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Woher Zuständigkeit je Bereich und Person kommt – und damit `PROD-017` | Meilenstein M6 |
| Ob die Endpunktprüfungen in Richtlinien wandern | Meilenstein M5.4 |
| Wie die Stichtagsabfrage zugeschnitten wird – eigene Regel oder Umschreibung | Mit der Umsetzung von M5.3 |
| Wie Feldmaskierung ohne Enterprise OPA gebaut wird, und was das für §12 bedeutet | Meilenstein M5.4 |
| Ob Kostenstelle und Region Kernspalten werden | Wenn es Entitäten dafür gibt, frühestens M7 |

## Nachweise

Erhoben am 2026-08-14 gegen `openpolicyagent/opa:1.19.0`.

**Einstufigkeit des Regelfragments.** Regel mit `input.requirement.dynamic_attributes.kostenstelle`:

```
pe_fragment_error: internal.member_2: invalid ref operand:
input.requirement.dynamic_attributes.kostenstelle
```

Gleiches Ergebnis, wenn `input.requirement.dynamic_attributes` zusätzlich als Unbekannte
deklariert wird. Es liegt an der Tiefe, nicht an der Deklaration.

**Verknüpfte Bedingungen.** Zwei Bedingungen in einem Regelkörper:

```json
{"operator":"and","type":"compound","value":[
  {"field":"requirement.tenant","operator":"in","value":["t-eins"]},
  {"field":"requirement.project_id","operator":"in","value":["p-1","p-2"]}]}
```

Zwei Regelkörper, beide erfüllbar:

```json
{"operator":"or","type":"compound","value":[
  {"operator":"and","type":"compound","value":[
    {"field":"requirement.tenant","operator":"in","value":["t-eins"]},
    {"field":"requirement.owner","operator":"eq","value":"m.weber"}]},
  {"field":"requirement.tenant","operator":"in","value":["t-eins"]}]}
```

Ist ein Zweig nicht erfüllbar, fällt er weg und es bleibt die einfache Form – die
Antwortgestalt hängt also von der Eingabe ab und nicht nur von der Richtlinie.

**Keine Masken im Upstream.** Eine `masks`-Regel neben `include`, geprüft sowohl unter
eigenem Paketnamen als auch unter der dokumentierten Konvention `package filters` mit
`POST /v1/compile/filters/include`: Die Antwort enthält ausschließlich `query`. Die in der
Dokumentation beschriebene Maskierung ist eine Funktion von Enterprise OPA.
