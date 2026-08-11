# ADR-0024: Bedingungen an Workflow-Übergängen – benanntes Vokabular statt Regel-Engine

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §7, §8, §17, §18
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§7 verlangt, dass Übergänge Bedingungen tragen können: Pflichtfelder, benötigte
Berechtigung, Vier-Augen-Prinzip, Genehmigungsschritte. Seit M4.2 erzwingt der Graph die
**Reihenfolge** – wer einen Übergang nehmen darf, wird nicht geprüft. Genau das hält
`PROD-052` offen: Ein Ablauf, der die Reihenfolge erzwingt und die Zuständigkeit nicht,
sieht aus wie eine Genehmigungsstrecke und ist keine.

Vier Fragen waren vor dem Zuschnitt von M4.3 zu klären.

**Wo lebt die benötigte Berechtigung?** §8 verlangt RBAC mit ABAC bis auf Feldebene; die
Policy-Engine ist bis M5 vertagt. Alles, was jetzt entsteht, droht ein zweites
Berechtigungssystem zu werden – wovor `PROD-017` ausdrücklich warnt.

**Woran wird das Vier-Augen-Prinzip festgemacht?** Die Historie führt je Version die
auslösende Identität; die Frage ist, wessen Handschrift verglichen wird.

**Wie verhalten sich Pflichtfelder am Übergang zu `required` am Attribut?** §6 kennt
Pflichtangaben je Anforderungstyp. Der Regelfall bei Workflows ist ein anderer: Ein Feld
ist beim Anlegen offen und wird erst zur Einreichung Pflicht.

**Braucht es eine Regel-Engine?** Die seit [ADR-0001](0001-backend-sprache-und-framework.md)
vertagte Wahl zwischen JSONLogic und json-rules-engine fällt hier – wenn sie überhaupt
fällt.

### Was die Aufbereitung ergeben hat

Zwei Annahmen aus der Vorbereitung haben sich als falsch erwiesen und sind der Grund für
den Zuschnitt unten:

- **Ein ODER zwischen Auslösern kostet nichts.** Jede Bedingung ist eine Implikation
  („wenn Vorbehalt, dann Anforderung"). Zwei Regeln mit derselben Folge ergeben zusammen
  `(A ∨ B) → R`. Die Verknüpfung mit UND liegt über den *Regeln*, nicht über den
  Auslösern.
- **Eine Regelliste aus Konjunktionen ist disjunktive Normalform** und damit
  aussagenlogisch vollständig. Ausdruckskraft kann deshalb nie der Auslöser für eine
  Engine sein – der Preis ist Wiederholung, nicht Unmöglichkeit.

## Entscheidung

**1. Eine Bedingung ist eine Implikation.**
Sie besteht aus einem optionalen Vorbehalt `nurWenn` und einer Anforderung. Fehlt der
Vorbehalt, gilt sie immer. Die Bedingungen eines Übergangs werden mit **UND** verknüpft –
jede muss erfüllt sein.

**2. Das Vokabular ist benannt und abgeschlossen.**
Es gibt eine feste Liste von Anforderungsarten und eine feste Liste von Vergleichen.
Innerhalb dieses Vokabulars stellt ein Administrator ohne Redeploy beliebig zusammen; eine
**neue Vokabel ist Code** – sie braucht einen Prüfer, eine Meldung und ein Bedienelement.
Derselbe Schnitt wie bei den Attributdatentypen nach
[ADR-0016](0016-ui-grundlage-und-datenzugriff-im-frontend.md).

Der vollständige Katalog steht in
[`docs/architecture/workflows.md`](../architecture/workflows.md#bedingungen-an-übergängen)
und ist Bestandteil dieser Entscheidung.

**3. Das gesamte Vokabular entsteht mit M4.3**, auch die Arten, für die es heute keinen
Anwendungsfall gibt. Begründung siehe unten.

**4. Die benötigte Berechtigung ist ein Rollenname am Übergang.**
`{ "art": "rolle", "eineVon": [...] }`, geprüft gegen die Realm-Rollen im Token,
Oder-Verknüpfung wie beim vorhandenen `@Rollen`.

**Das erfüllt §8 nicht.** Die Rolle gilt global – „Freigeber" heißt „Freigeber überall",
nicht „Freigeber für dieses Projekt, diese Kostenstelle, diesen Mandanten". `PROD-017` ist
entsprechend zu ergänzen.

**5. Das Vier-Augen-Prinzip verweist auf einen benannten Zustand**, nicht auf den
vorherigen Übergang: *„Freigeben verlangt eine andere Person als die, die `in_pruefung`
ausgelöst hat."*

**6. Pflichtfelder am Übergang sind von `required` am Attribut getrennt.**
Die Attributdefinition beantwortet, **was diese Art von Anforderung hat**; der Übergang,
**was gefüllt sein muss, um hier weiterzukommen**. `required` in der Attributdefinition
bekommt keinen Zustandsbezug.

**7. Nicht auswertbare Bedingungen weisen ab.**
Fehlt ein Feld, ist ein Wert nicht vergleichbar oder eine Bedingung unvollständig, gilt
sie als **nicht erfüllt** – der Übergang scheitert. Niemals „im Zweifel durchlassen".

**8. Bedingungen werden beim Speichern geprüft, nicht erst beim Benutzen.**
Zustandsverweise – etwa der Bezug des Vier-Augen-Prinzips – prüft `pruefeGraph`, wie schon
die Verweise der Übergänge. **Feldnamen kann `pruefeGraph` nicht prüfen**: Die
Attributdefinitionen sind Laufzeitdaten, und das Modul hängt bewusst an nichts. Diese
Prüfung liegt im Service, der die Definitionen ohnehin liest.

**9. Keine Regel-Engine.**
Die Wahl fällt, **sobald eine Regel entsteht, die für sich gelesen keinen Satz ergibt** –
also ein Bruchstück, das nur existiert, weil ein UND über ein ODER verteilt wurde.

**10. Vergleiche gegen dienstfremde Daten werden beim Erfassen materialisiert.**
Ob eine Bestellung von einer Standardgröße abweicht, ist eine Frage an den Service-Typ-
Katalog des Infrastructure Service (§18). Eine Bedingung darf ihn **nicht** zur Laufzeit
lesen – [ADR-0021](0021-anbindung-externer-workflows.md) Punkt 1 schließt synchrone Aufrufe
in Übergängen aus. Der Erfassungsweg hält den Befund als Feld an der Anforderung fest
(`standardkonform`), und der Übergang prüft dieses lokale Feld.

## Begründung

**Zu 2 und 4 – warum ein Rollenname und kein Ausdruck.** Es hilft, Datum und Prüfer zu
trennen: *Welche Zuständigkeit ein Übergang verlangt*, ist in jeder Zukunft ein Fachdatum –
auch eine OPA-Policy muss es von irgendwoher erfahren. Was M5 ändert, ist die Auswertung.
Ein Rollenname ist das Kleinste, das diesen Wechsel übersteht. Ein abstrakter
Berechtigungsname überstünde ihn womöglich besser, verlangt aber schon heute eine Zuordnung
von Berechtigung auf Rolle – und die ist genau die halb gebaute Berechtigungsschicht, vor
der `PROD-017` warnt.

Dass die Zuständigkeit **im Graphen** liegt, hat eine Eigenschaft, die eine eigene Tabelle
nicht hätte: Sie ist mitversioniert und je Anforderung festgeschrieben. Ändert jemand die
Freigaberolle, gilt das für laufende Anforderungen nicht – sie behalten die Zuständigkeit,
unter der sie gestartet sind. Für eine Genehmigungsstrecke ist das die richtige
Eigenschaft, und sie entsteht ohne zusätzlichen Mechanismus.

**Zu 5 – warum ein Zustand und nicht der vorherige Übergang.** „Der Auslöser des
unmittelbar vorherigen Übergangs" wäre billiger, hängt aber an der Form des Graphen: Wird
zwischen Einreichung und Freigabe ein Zwischenschritt eingefügt, vergleicht die Prüfung
plötzlich gegen den Prüfer statt gegen den Einreicher. Die Regel besteht weiter, sie meint
nur etwas anderes – und niemand bemerkt es. Der Zustandsbezug steht dagegen ausdrücklich
da und ist prüfbar.

Ein eigener Fall „nicht der Ersteller" ist nicht nötig: Der Anfangszustand wird beim
Anlegen betreten, ein Verweis darauf trifft also den Ersteller.

**Zu 6 – warum getrennt.** Führte man beides zusammen, wäre eine Attributdefinition nur
noch im Verbund mit einem Workflow verständlich, und §6 und §7 verlören ihre Grenze. Der
Regelfall spricht ohnehin dagegen: Eine Begründung, die erst zur Einreichung Pflicht wird,
ist am Attribut nicht ausdrückbar, ohne dort einen Zustandsbegriff einzuführen.

**Zu 7 – warum abweisen und nicht durchlassen.** Eine Bedingung, die mangels Daten nicht
ausgewertet werden kann, ist der Fall, in dem am wenigsten über die Lage bekannt ist. Wer
dort durchlässt, hat eine Genehmigungsstrecke, die genau dann nachgibt, wenn etwas nicht
stimmt. Die Gegenrichtung ist sichtbar: Der Übergang scheitert mit einer Meldung, und
jemand sieht nach.

**Zu 9 – warum keine Engine, obwohl der Bedarf absehbar ist.** Nicht wegen mangelnder
Fälle – Schwellenwerte und Abweichungen sind konkret und kommen. Sondern wegen der
**Meldung**: Eine benannte Bedingung kann sagen *„Die Freigabe verlangt eine andere Person
als die Einreichung"*; eine Engine sagt *„Bedingung nicht erfüllt"*. Das ist die Sorte
Meldung, die jemanden an der falschen Stelle suchen lässt – dieselbe Überlegung, aus der
der unbekannte Ausgangszustand in [ADR-0022](0022-statuswechsel-als-eigener-vorgang.md)
eine eigene Meldung bekommen hat.

Dazu kommt die Prüfbarkeit: Ein benanntes Vokabular lässt sich beim Speichern gegen die
vorhandenen Zustände und Felder halten. Ein freier Ausdruck lässt das nur eingeschränkt zu,
und ein Formular kann ihn nicht als Formular anbieten.

**Zu 3 – warum auch die ungenutzten Arten jetzt entstehen.** Weil eine neue Vokabel Code an
drei Stellen ist – Prüfer, Meldung, Bedienelement –, wartet jeder Bedarf, der später
auftaucht, auf eine Auslieferung. Ein vollständiges Vokabular verschiebt die Grenze des
ohne Redeploy Konfigurierbaren genau dorthin, wo §7 sie haben will.

Der Preis ist zu benennen: **Eine implementierte, aber nie benutzte Bedingungsart ist im
Betrieb ungeprüft.** Wertete sie stillschweigend zu „erfüllt" aus, fiele es niemandem auf –
es gibt keinen Benutzer, dem es auffallen könnte. Daraus folgt Punkt 7 (im Zweifel
abweisen) und die Auflage, dass **jede Art mit einem eigenen Test entsteht**, positiv wie
negativ, unabhängig davon, ob sie gebraucht wird.

**Zu 10 – warum materialisieren mehr ist als ein Umweg.** Der Befund wird damit Bestandteil
des versionierten Zustands. Ob eine Anforderung im März 2027 als standardkonform galt, ist
eine Stichtagsabfrage – auch dann noch, wenn der Katalog sich seither geändert hat. Eine
Bedingung, die zur Laufzeit gegen den heutigen Katalog liest, wüsste nur, was **heute**
Standard ist. Für den Nachweiszweck aus
[ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) ist die Materialisierung
nicht der Umweg, sondern der richtige Weg.

## Betrachtete Alternativen

### Regel-Engine (JSONLogic oder json-rules-engine)

Beliebige Ausdrücke über Feldwerte, ohne dass für eine neue Bedingungsform Code entsteht –
die Grenze des ohne Redeploy Konfigurierbaren läge weiter außen.

**Nicht gewählt.** Allgemeine Meldungen, kein Formular, eingeschränkte Prüfbarkeit beim
Speichern. Die Entscheidung ist nicht endgültig: Punkt 9 nennt den Auslöser, und Punkt 2
lässt eine Art `ausdruck` neben die vorhandenen treten, ohne sie anzufassen.

### Abstrakter Berechtigungsname statt Rollenname

`"requirement.transition.approve"` statt `"freigeber"` – überstünde M5 womöglich besser.

**Nicht gewählt.** Verlangt heute eine Zuordnung von Berechtigung auf Rolle. Diese
Zuordnung ist ein eigenes Konfigurationsobjekt und damit die halb gebaute
Berechtigungsschicht, die `PROD-017` als gefährlicher als gar keine beschreibt.

### Vier-Augen gegen den unmittelbar vorherigen Übergang

Kein Verweis, kein zusätzliches Feld, keine Prüfung beim Speichern.

**Nicht gewählt**, siehe Begründung zu 5: Die Bedeutung hinge an der Form des Graphen und
änderte sich bei jeder Einfügung stillschweigend.

### Bedingungen in eigenen Tabellen statt im Graphen

Auswertbar per SQL – „welche Übergänge verlangen Rolle X?" wäre eine Spaltenabfrage.

**Nicht gewählt.** Der Graph ist ein Wert und wird als Ganzes versioniert; Bedingungen
daneben zu legen hieße, die Fassung einer Anforderung wieder aus zwei Quellen
zusammenzusetzen – genau das, was M4.1 vermieden hat. Die Auswertungsfrage bleibt lösbar:
JSONB mit GIN-Index, bei zweistelliger Zahl von Definitionen ohnehin folgenlos.

### `required` der Attributdefinition um einen Zustandsbezug erweitern

Ein Ort für alle Pflichtangaben.

**Nicht gewählt**, siehe Begründung zu 6.

## Konsequenzen

### Positiv

- `PROD-052` wird geschlossen: Der Ablauf erzwingt Reihenfolge **und** Zuständigkeit
- Zuständigkeiten sind mitversioniert; eine Änderung wirkt nicht auf laufende Anforderungen
- Bedingungen sind beim Speichern prüfbar und beim Scheitern erklärbar
- Das Vokabular ist als Formular darstellbar – Voraussetzung für M4.6
- §19.2 bleibt gewahrt: Dieselben Bedingungen gelten für Oberfläche, Schnittstelle und
  Import, weil sie im Übergang liegen und nicht im Erfassungsweg

### Negativ und Risiken

- **Die Rolle gilt global.** Eine Freigaberolle am Übergang sieht aus wie eine
  zugeschnittene Zuständigkeit und ist es nicht – der Objektbezug kommt erst mit M5. Das
  ist die Wiederholung des Musters aus `PROD-052`, eine Ebene tiefer, und gehört dort
  vermerkt
- **Ungenutzte Bedingungsarten sind im Betrieb ungeprüft.** Abgefedert durch Punkt 7 und
  die Testauflage, aber nicht beseitigt: Der erste echte Einsatz einer Art ist immer auch
  ihr erster Praxistest
- **Wiederholung statt Verschachtelung.** Ein Vorbehalt, der für mehrere Regeln gilt, steht
  mehrfach da und muss mehrfach geändert werden. Tragbar, solange jede Regel für sich einen
  Satz ergibt – genau das ist der Auslöser aus Punkt 9
- **Materialisierte Befunde können veralten.** `standardkonform` beschreibt den Stand zum
  Erfassungszeitpunkt. Ändert sich der Katalog, stimmt der Wert nicht mehr mit der
  Gegenwart überein – für den Nachweis richtig, für eine tagesaktuelle Auswertung
  irreführend. Wer Letzteres braucht, rechnet gegen den Katalog, nicht gegen das Feld

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Objektbezogene Zuständigkeit statt globaler Rolle | Meilenstein M5 mit der Policy-Engine |
| Regel-Engine, falls der Auslöser aus Punkt 9 eintritt | wenn er eintritt |
| Ob die Bereitstellungskategorie eine zweite Schlüsseldimension der Workflows wird – ein Vorbehalt an *jeder* Regel eines Übergangs ist meist kein Vorbehalt, sondern ein anderer Workflow | Meilenstein M6 mit §17 |
| Verwaltungsoberfläche für Bedingungen | Meilenstein M4.6 |
