# ADR-0005: API-First-Workflow mit OpenAPI 3.1

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §3, §4, §6, §12, §16
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§2 nennt „API First" als Grundprinzip. §3 fordert typsichere API-Kommunikation im
Frontend über einen OpenAPI-Client-Generator. §4 fordert versionierte Schnittstellen.
§12 fordert versionierte, OpenAPI-dokumentierte Lese-APIs zur Weiterverarbeitung durch
Dritte.

Damit ist der OpenAPI-Contract kein Nebenprodukt der Implementierung, sondern ein
eigenständiges, versioniertes Artefakt mit externen Konsumenten.

Gleichzeitig gilt eine praktische Randbedingung aus
[ADR-0001](0001-backend-sprache-und-framework.md): NestJS ist code-first ausgelegt. Der
Contract entsteht dort aus Decorators. Werkzeuge, die aus einer Spezifikation
NestJS-Server-Rümpfe erzeugen, liefern Ergebnisse, die mit dem Dependency-Injection- und
Decorator-Modell des Frameworks in Konflikt geraten und in der Praxis von Hand
nachbearbeitet werden – womit die Generierung ihren Zweck verliert.

## Entscheidung

**OpenAPI 3.1** ist das Contract-Format. Je Service liegt eine Spezifikationsdatei als
eingechecktes Artefakt unter `docs/api/<service>.openapi.yaml`.

Der Arbeitsablauf ist wie folgt festgelegt:

1. **Vor der Implementierung** wird der zu bauende Endpunkt im Contract entworfen –
   Pfad, Verben, Statuscodes, Fehlerformat, Schemata. Der Entwurf ist die
   Diskussionsgrundlage, nicht der fertige Code.
2. **Die Implementierung** erfolgt in NestJS mit `@nestjs/swagger`-Decorators.
3. **Die Spezifikation wird aus dem laufenden Code exportiert** und in
   `docs/api/<service>.openapi.yaml` eingecheckt.
4. **Die CI erzwingt Deckungsgleichheit** (Drift-Gate): Sie exportiert die Spezifikation
   erneut und vergleicht sie mit der eingecheckten Datei. Jede Abweichung bricht den
   Build. Eine Verhaltensänderung an der Schnittstelle ist damit ohne bewussten
   Spezifikations-Commit unmöglich.
5. **Die CI erkennt inkompatible Änderungen** (Breaking-Change-Gate): Die Spezifikation
   wird mit `oasdiff` gegen den letzten freigegebenen Stand verglichen. Inkompatible
   Änderungen brechen den Build, sofern die Hauptversion nicht angehoben wird.
6. **Konsumenten werden generiert, niemals handgeschrieben.** Der Frontend-Client und
   Service-zu-Service-Clients entstehen ausschließlich aus der eingecheckten
   Spezifikation und liegen als Pakete unter `packages/`.

**Versionierung:** über den Pfad (`/v1/...`). Eine Hauptversion bleibt abwärtskompatibel;
inkompatible Änderungen erzeugen eine neue Hauptversion, wobei beide Versionen für eine
definierte Übergangszeit parallel bedient werden.

**Fehlerformat:** RFC 9457 (`application/problem+json`), einheitlich über alle Services.

## Begründung

**Die Spezifikation ist die Schnittstelle zu allen Konsumenten.** Solange sie als
eingechecktes Artefakt existiert, gegen das generiert und geprüft wird, erfüllt sie ihre
Aufgabe – unabhängig davon, ob sie von Hand geschrieben oder aus dem Code exportiert
wurde.

**Das Drift-Gate stellt die eigentliche Eigenschaft her.** Der Kern von „API First" ist
nicht die Reihenfolge des Tippens, sondern dass die Schnittstelle nicht unbemerkt
abdriften kann. Genau das erzwingt Schritt 4: Wer den Code ändert, muss die
Spezifikationsänderung explizit committen und im Review sichtbar machen.

**Generierte Server-Rümpfe würden mehr Schaden anrichten als Nutzen bringen.** Siehe
Kontext.

**OpenAPI 3.1 statt 3.0**, weil 3.1 vollständig mit JSON Schema Draft 2020-12
kompatibel ist. Das ist für §6 wesentlich: Die zur Laufzeit aus Attributdefinitionen
erzeugten Schemata können unverändert in die Spezifikation und an das Frontend gereicht
werden, ohne Umschreibung zwischen zwei Schema-Dialekten.

## Betrachtete Alternativen

### Reines Contract-First mit Server-Generierung

Die Spezifikation wird von Hand geschrieben, Server-Rümpfe und Client werden daraus
generiert. Die reinste Auslegung von „API First".

Nicht gewählt aus dem im Kontext genannten Grund: Die verfügbaren NestJS-Generatoren
erzeugen Code, der gegen das Framework arbeitet. Wird der generierte Code anschließend
von Hand angepasst, ist der Contract nicht mehr die Quelle der Wahrheit, sondern nur noch
eine Startvorlage – schlechter als der gewählte Weg, weil das Auseinanderlaufen dann
nicht einmal geprüft wird.

### Contract-First mit reiner Typgenerierung

Die Spezifikation wird von Hand geschrieben; daraus werden **nur Typen** erzeugt, die die
Controller implementieren müssen. Abweichungen werden zu Übersetzungsfehlern.

Fachlich die sauberste Variante und ausdrücklich nicht verworfen, sondern **vertagt**.
Sie erfordert mehr Einrichtungsaufwand und Erfahrung mit dem Zusammenspiel der
generierten Typen und der NestJS-Controller-Signaturen. Überprüfungszeitpunkt: nach M2,
wenn der erste Contract stabil ist und der tatsächliche Nutzen beurteilbar wird.

### Kein eingechecktes Artefakt, Spezifikation nur zur Laufzeit unter `/api-docs`

Nicht gewählt: Ohne eingechecktes Artefakt gibt es nichts zu versionieren, nichts zu
vergleichen und keine Grundlage für die Erkennung inkompatibler Änderungen. §12 wäre
nicht erfüllbar.

## Konsequenzen

### Positiv

- Contract-Änderungen sind im Review sichtbar, weil sie als Dateiänderung erscheinen.
- Inkompatible Änderungen werden maschinell erkannt, nicht durch Aufmerksamkeit.
- Frontend und Service-zu-Service-Clients sind typsicher und können nicht von der
  tatsächlichen Schnittstelle abweichen (§3).
- Externe Konsumenten (§12) erhalten ein stabiles, versioniertes Artefakt.

### Negativ und Risiken

- **Nicht buchstäblich contract-first.** Der Entwurf in Schritt 1 ist eine Konvention,
  keine technisch erzwungene Reihenfolge. Wer sie überspringt, wird vom Drift-Gate nicht
  aufgehalten – nur die Folgen einer unbemerkten Änderung werden verhindert.
- **Das Drift-Gate braucht einen reproduzierbaren Export.** Nichtdeterministische
  Reihenfolgen im generierten Dokument würden zu falsch-positiven Fehlschlägen führen.
  Beim Aufbau in M1 ist auf stabile Sortierung zu achten.
- **Dynamische Attribute erscheinen nicht vollständig in der statischen Spezifikation.**
  Die Attributdefinitionen aus §6 sind Fachdaten und zur Bauzeit unbekannt. Der Contract
  beschreibt das dynamische Feld daher generisch und verweist auf den Endpunkt, der das
  zum Anforderungstyp gehörende JSON Schema zur Laufzeit ausliefert. Diese Zweistufigkeit
  ist bewusst und muss in der Dokumentation der API erklärt werden.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Client-Generator für das Frontend (`openapi-typescript` bzw. Alternative) | M2 |
| Werkzeug und Konfiguration für das Drift-Gate | M0, Schritt 3 |
| Umstieg auf reine Typgenerierung aus handgeschriebener Spezifikation | Überprüfung nach M2 |
| Ereignis-Contracts und Schema-Registry (§12) | Sobald Messaging eingeführt wird |
