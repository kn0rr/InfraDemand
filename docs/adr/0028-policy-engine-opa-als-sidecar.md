# ADR-0028: Policy-Engine OPA als Sidecar

- **Status:** Angenommen
- **Datum:** 2026-08-13
- **Betrifft:** CLAUDE.md §4, §8, §14
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0004](0004-authentifizierung-und-autorisierung.md) hat die Wahl der Policy-Engine
ausdrücklich auf Meilenstein M5.2 vertagt. Dieser ist erreicht.

Was heute steht: eine grobe Rollenprüfung über `@Rollen("platform-admin")`, eine Rolle je
Workflow-Übergang, und seit M5.1 der Mandantenzuschnitt als SQL-Filter. Was §8 verlangt,
steht nicht: Objektebene, Feldebene, und Berechtigungen als versionierte, testbare
Artefakte. `PROD-017` hält fest, dass ein Produktivgang davor ausgeschlossen ist.

§8 nennt zwei Formen von Berechtigung, die verschiedene Werkzeuge bevorzugen:

- **regelhaft** – „darf freigeben, wenn Feld X gesetzt ist": Attribute, Bedingungen,
  Feldebene
- **beziehungshaft** – „wer darf diese Anforderung sehen": Zuständigkeit je Projekt,
  Organisation, Region, Kostenstelle

Die beiden Kandidaten decken je eine Form gut ab: OPA die erste, OpenFGA die zweite.

### Was aus anderen Entscheidungen bereits feststeht

[ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) verlangt, dass der Zustand zu
einem beliebigen vergangenen Zeitpunkt **abfragbar** ist, nicht rekonstruierbar. Zweck ist
Nachweisfähigkeit. Eine Berechtigungsentscheidung ist Teil dieses Zustands: „wer durfte das
im März sehen" ist eine Frage, die an eine Plattform mit Compliance-Anspruch gestellt wird.

[ADR-0003](0003-datenbank-und-datenhoheit.md) hält die Datenhoheit je Service fest.
§4 verlangt unabhängiges Deployment je Service.

## Entscheidung

**1. Die Policy-Engine ist OPA.** Richtlinien in Rego, als versionierte Dateien im
Repository, mit `opa test` im selben CI-Lauf geprüft wie der übrige Code.

**2. OPA läuft als Sidecar neben dem Dienst**, nicht als Bibliothek im Prozess und nicht
als zentraler Dienst für die Plattform.

**3. Die Entscheidungsgrundlagen bleiben die Fachdaten.** Es entsteht **kein zweiter
Bestand**, der Berechtigungstatsachen führt. Was die Engine auswertet, steht in Tabellen,
die bereits vollständig versioniert sind.

**4. Gefilterte Listen entstehen über partielle Auswertung**, nicht über zeilenweise
Prüfung. Die Richtlinie erzeugt eine Bedingung, die in die Abfrage einfließt.

**5. Antwortet der Sidecar nicht, gilt die Anfrage als abgelehnt.** Fail-closed, dieselbe
Festlegung wie bei der Bedingungsauswertung in
[ADR-0024](0024-bedingungen-an-workflow-uebergaengen.md).

**6. M5.2 liefert ausschließlich den Rahmen:** Anbindung, **eine** Richtlinie als Nachweis,
das Testverfahren und die Protokollierung der Entscheidung. Die vorhandenen Guards bleiben
zunächst bestehen. M5.3 und M5.4 füllen den Rahmen.

**7. OpenFGA wird erneut geprüft, sobald eine Zuständigkeitsfrage nicht mehr durch ein
Prädikat über Spalten der Zeile zu beantworten ist.** Das ist der Auslöser – kein Datum.

## Begründung

**Zu 1 – warum OPA und nicht OpenFGA.** Ausschlaggebend ist die Zeitachse. OpenFGA führt
Beziehungstupel im Präsens: Eine entzogene Zuständigkeit ist weg. Um §19.4 zu erfüllen,
müsste der Tupelbestand **selbst** versioniert werden – ein zweites Historienmodell neben
dem, das bereits steht, mit eigener Abgleichfrage. Bei OPA sind die Grundlagen die
Fachdaten, und die tragen ihre Historie schon.

Zweitens: Die Zuschnittsdimensionen aus §8 – Projekt, Organisation, Region, Kostenstelle –
sind **Spalten an der Zeile**, keine tiefe Beziehungsstruktur. OpenFGA verdient seinen
Preis bei transitiven Beziehungen über mehrere Ebenen. Ein Beziehungsgraph löst hier ein
Problem, das wir nicht haben; der Mandantenfilter aus M5.1 zeigt die Form der Lösung
bereits.

Drittens: „Policy-as-Code: versioniert, testbar, auditierbar" aus §8 beschreibt Rego-Dateien
im Repository wörtlich. Eine Tupeldatenbank ist Daten, keine Artefakte – versionierbar nur
über einen zusätzlichen Mechanismus.

**Zu 1 – warum nicht beide.** Zwei Engines heißen zwei Orte, an denen eine Berechtigung
entsteht, und damit eine Verknüpfungsregel als eigenen Gegenstand: Wer wird zuerst gefragt,
überstimmt ein Nein ein Ja, was gilt bei Ausfall eines der beiden. Das ist genau die Sorte
Regel, die niemand aufschreibt und die anschließend aus der Reihenfolge im Code folgt –
dasselbe Muster, das ADR-0026 bei den doppelten Attributdefinitionen aufgelöst hat.

Die Nachteile von OpenFGA verschwinden zudem nicht dadurch, dass OPA danebensteht: Der
zweite Bestand bleibt, der Abgleich bleibt, die fehlende Zeitachse bleibt. Für einen
Nachweis ist eine **halb** rekonstruierbare Entscheidung so gut wie keine.

Die Umkehrbarkeit zeigt in dieselbe Richtung: OpenFGA später hinzuzunehmen ist additiv. Es
später wieder herauszunehmen ist es nicht, weil die Tupel dann Fachwissen tragen, das
nirgends sonst steht.

**Zu 2 und 4 – warum Sidecar.** Der Grund ist nicht Betrieb, sondern die seitenweise
Ausgabe. Eine gefilterte Liste lässt sich auf zwei Wegen bauen: alles lesen und je Zeile
fragen – dann muss die **gesamte** Tabelle ausgewertet werden, um die erste Seite mit
zwanzig Einträgen auszuliefern. Oder die Richtlinie erzeugt eine Bedingung für die Abfrage.
Berechtigungsfilterung und Seitenaufteilung sind dasselbe Problem: Man kann nicht blättern,
bevor gefiltert ist.

Der zweite Weg ist die partielle Auswertung, und die ist über die WASM-Einbettung **nicht
verfügbar** – die Compile-API fehlt dem NPM-Paket und ist dort auch nicht vorgesehen (siehe
Nachweise). Wer sie braucht, betreibt OPA als Dienst oder bettet die Go-Bibliothek ein;
letzteres scheidet bei einem NestJS-Dienst aus.

Die Bibliothek ist damit keine billigere Variante desselben Wegs, sondern ein anderer Weg
mit einer Sackgasse genau dort, wo M5.3 und M5.4 ankommen. Eine Variante zu wählen, von der
schon feststeht, dass sie ersetzt werden muss, entwertet den Zweck von Punkt 6.

**Zu 2 – warum kein zentraler Dienst.** §4 verlangt unabhängiges Deployment je Service.
Eine gemeinsame Instanz wäre ein gemeinsamer Ausfallpunkt für sämtliche
Berechtigungsprüfungen der Plattform: Fällt sie aus, ist nirgends mehr etwas autorisiert.
Beim Sidecar teilt der Ausfall das Schicksal des Dienstes, zu dem er gehört – das ist die
richtige Kopplung.

**Zu 5 – warum fail-closed.** Eine nicht getroffene Entscheidung ist keine Erlaubnis. Bei
einem nicht erreichbaren Sidecar durchzulassen hieße, die Berechtigungsprüfung durch einen
Netzwerkfehler abschaltbar zu machen.

**Zu 6 – warum nur der Rahmen.** Die partielle Auswertung ist der anspruchsvollste Teil von
OPA. Ob sie mit diesem Datenmodell trägt, ist eine offene Frage, und sie sollte an **einer**
Richtlinie beantwortet sein, bevor das Zuständigkeitsmodell daran hängt. Käme M5.3 gleich
mit, wären bei einem Fehlschlag zwei Ursachen möglich und keine auszuschließen.

## Betrachtete Alternativen

### OpenFGA

Beziehungstupel nach Zanzibar, `ListObjects` eingebaut – die Listenfrage wäre gelöst, ohne
partielle Auswertung.

**Nicht gewählt.** Zweiter Datenbestand mit Abgleichpflicht, und keine Zeitachse. Die
Stärke betrifft eine Frage, die dieses Datenmodell per SQL beantwortet; die Schwäche
betrifft eine Zusicherung, die hier tragend ist.

### Beide Engines nebeneinander

Jede dort, wo sie stark ist.

**Nicht gewählt**, siehe Begründung. Es kauft eine Fähigkeit, für die sich heute kein
Anwendungsfall benennen lässt, zum Preis einer Verknüpfungsregel, die niemand geschrieben
hat.

### OPA als WASM-Bibliothek im Dienst

Auswertung im Prozess: keine Latenz, kein zusätzlicher Container, kein Netzwerkweg.

**Nicht gewählt.** Compile-API und partielle Auswertung stehen dort nicht zur Verfügung.
Für M5.2 würde es genügen – und müsste für M5.3 ersetzt werden.

### OPA als zentraler Dienst

Eine Instanz für die gesamte Plattform, einmal betrieben statt je Dienst.

**Nicht gewählt.** Gemeinsamer Ausfallpunkt, Widerspruch zu §4.

### Die Entscheidung erneut vertagen

Guards behalten, M5.3 und M5.4 ohne Engine bauen.

**Nicht gewählt.** Eine zweite Vertagung ohne beobachtbaren Auslöser wäre eine stille
Absage an §8 – und die Feldebene aus M5.4 ohne Engine zu bauen hieße, die Engine später
gegen bestehenden Code zu setzen statt an seine Stelle.

## Konsequenzen

### Positiv

- Berechtigungen werden zu Dateien im Repository: im Diff sichtbar, im Review lesbar, mit
  `opa test` prüfbar – wörtlich das, was §8 unter Policy-as-Code fordert
- Kein zweiter Bestand, kein Abgleich, keine zweite Zeitachse
- Die Engine ist sprachunabhängig und für M7 und M8 ohne Änderung wiederverwendbar
- Der Zuschnitt von M5.2 ist klein genug, dass ein Rückzug einen Container und eine Datei
  kostet

### Negativ und Risiken

- **Zwei Orte für Berechtigungslogik während des Zwischenzustands.** Guards und Engine
  bestehen nebeneinander, bis M5.3 und M5.4 sie zusammenführen. **Woran es auffiele:** an
  einer Prüfung, die an einer Stelle greift und an der anderen nicht – und das fällt nur
  auf, wenn jemand beide Stellen kennt. Als Eintrag in die Produktionsreife-Liste
  aufzunehmen, sobald der Rahmen steht
- **Rego ist eine eigene Sprache.** Eine falsch geschriebene Regel ist kein
  Darstellungsfehler, sondern ein Sicherheitsfehler. Das Testverfahren aus Punkt 6 ist
  deshalb nicht optional, sondern Teil der Anbindung
- **Ein Container mehr je Umgebung**, auch lokal. Wer ihn vergisst, bekommt nach Punkt 5
  überall 403 – unangenehm, aber sichtbar, und das ist die richtige Richtung
- **Ob die partielle Auswertung mit diesem Datenmodell trägt, ist unbewiesen.** Genau das
  soll M5.2 zeigen. Trägt sie nicht, ist die Wahl zu überdenken – dann aber mit einer
  Richtlinie im Rücken statt mit einer Vermutung
- **Die Verteilung der Richtlinien an den Sidecar ist offen** und berührt §14

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Wie die Richtlinien zum Sidecar gelangen – Bundle-Server, OCI-Artefakt oder ins Abbild gebacken | Mit der ersten nicht-lokalen Umgebung (§14) |
| Ob Auswertungsergebnisse in den Auditpfad gehören oder einen eigenen Protokollstrom bilden | Mit dem Audit-Ereignisschema (M1.4, offen) |
| Ob OpenFGA doch gebraucht wird | Sobald eine Zuständigkeitsfrage nicht mehr durch ein Prädikat über Spalten der Zeile zu beantworten ist |
| Wie Feldebene und Contract zusammengehen (§12) | Meilenstein M5.4 |
| Ob die übrigen Dienste denselben Sidecar-Zuschnitt erhalten | Meilenstein M7 |

## Nachweise

Zur Aussage, dass partielle Auswertung über die WASM-Einbettung nicht zur Verfügung steht:

- [Support Partial Evaluation in WASM](https://github.com/open-policy-agent/opa/issues/3407) –
  offener Wunsch beim OPA-Projekt, nicht umgesetzt
- [Compile policy · npm-opa-wasm Issue #1](https://github.com/open-policy-agent/npm-opa-wasm/issues/1) –
  die Compile-API ist über das NPM-Paket nicht verfügbar; wer sie braucht, betreibt OPA als
  Dienst oder bettet die Go-Bibliothek ein
- [WebAssembly | Open Policy Agent](https://www.openpolicyagent.org/docs/wasm)

Abgerufen am 2026-08-13. Die Aussage ist vor der Umsetzung erneut zu prüfen – sie ist der
einzige Grund gegen die Bibliothek, und ein Wegfall würde Punkt 2 neu aufwerfen.
