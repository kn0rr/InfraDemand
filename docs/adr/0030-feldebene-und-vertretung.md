# ADR-0030: Feldebene und Vertretung

- **Status:** Angenommen
- **Datum:** 2026-08-17
- **Betrifft:** CLAUDE.md §6, §8, §12
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

M5.3 hat den Lesezuschnitt auf die Engine gestellt ([ADR-0029](0029-zuschnitt-der-zustaendigkeit.md)),
aber zwei Enden offen gelassen:

- **`PROD-060`:** Der Zuschnitt gilt für die Liste, nicht für den direkten Zugriff über
  Kennung und Herkunft. Er kann nicht geschlossen werden, solange eine Anforderung nur
  ihren Eigentümer kennt – dieselben zwei Stellen tragen den Schreibpfad, und ein
  Abwesender nähme seine Vorgänge mit.
- **Die Feldebene** aus §8, mit der offenen Frage, wie sie ohne Enterprise OPA entsteht.

### Ein Widerspruch zwischen §6 und §8

§6 führt „Sichtbarkeit und Editierbarkeit je Rolle" **als Bestandteil der
Attributdefinition** – also als Fachdatum, ohne Redeploy pflegbar. §8 verlangt
**Policy-as-Code**: versioniert, testbar, im Repository. Für dieselbe Sache.

Hinzu kommt: Kernfelder wie `owner`, `status` oder `projectId` haben überhaupt keine
Attributdefinition.

### Geprüfte Randbedingungen

**Nur eine Gruppe je Anforderung ist zuschneidbar.** Eine Menge auf der unbekannten Seite
weist das Regelfragment ab (siehe Nachweise). Die Frage „eine oder mehrere" ist damit nicht
Geschmack, sondern entschieden.

**Maskierung ist keine Filterung.** Sie entscheidet über die Ausgabe einer bereits
ausgewählten Zeile und erzeugt keine `WHERE`-Bedingung. Deshalb gilt für sie die
Einstufigkeit aus ADR-0029 Punkt 1 **nicht** – ein dynamisches Attribut lässt sich
verbergen, obwohl es keine Zeilen zuschneiden kann.

## Entscheidung

**1. Eine Anforderung trägt genau eine zuständige Gruppe**, als Kernspalte. Die
Zugehörigkeit erreicht die Anwendung als Anspruch `gruppen` im Token. Die Gruppe ist ein
Bezeichner ohne Entität – geprüft wird gegen nichts außer dem Token, genau wie beim
Mandanten ([ADR-0026](0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 6).

**2. `PROD-060` wird in diesem Meilenstein geschlossen, und erst nach Punkt 1.** `ausKennung`
und `ausHerkunft` erhalten dieselbe Bedingung wie die Liste; ein nicht sichtbarer Datensatz
liefert **404 und nicht 403**. Damit wird auch das Ändern zur Sache von Eigentümer, Gruppe
und Betreibern.

**3. Feldsichtbarkeit wird in der Attributdefinition gepflegt und von der Engine
entschieden.** §6 behält die Pflegestelle, §8 den Entscheidungspunkt.

**4. Die Definitionen erreichen die Engine als `input`, niemals als deren
`data`-Dokument.** Der Dienst lädt sie ohnehin für die Validierung und gibt sie mit. Ein
`data`-Dokument in OPA wäre ein zweiter Bestand mit Abgleichpflicht – ausgeschlossen durch
[ADR-0028](0028-policy-engine-opa-als-sidecar.md) Punkt 3 – und erreichbar nur über den
Endpunkt, den `authz.rego` sperrt.

**5. Kernfelder haben keine Definition; ihre Sichtbarkeit steht in der Richtlinie.** Das ist
die eine Stelle, an der Feldsichtbarkeit Code ist, und sie ist es aus Mangel an einem
Fachdatum, nicht aus Vorliebe.

**6. Das Zuschneiden der Antwort geschieht im Dienst**, gegen die von der Engine gelieferte
Feldmenge. OPA liefert die Liste, nicht die zugeschnittene Antwort.

**7. Die Reihenfolge ist verbindlich: Vertretung, dann `PROD-060`, dann Feldebene.**

## Begründung

**Zu 1 – warum eine Gruppe und nicht mehrere.** Das Regelfragment verlangt auf der
unbekannten Seite einen Skalar. Mehrere Gruppen je Anforderung wären nur über eine
nachträgliche Filterung abzubilden, und die zerstört die seitenweise Ausgabe – also genau
das, wofür der Sidecar gewählt wurde (ADR-0028).

**Zu 2 – warum erst nach Punkt 1.** Ohne Vertretung bindet die Verengung eine Anforderung an
genau einen Menschen. `PROD-060` nennt als Auslöser deshalb nicht ein Datum, sondern ein
zweites zuständigkeitstragendes Merkmal, das mehr als eine Person erfüllen kann.

**Zu 3 – warum nicht getrennt nach Attributen und Kernfeldern.** Zwei Orte, an denen
Feldsichtbarkeit entsteht, erzwingen eine Verknüpfungsregel für den Fall, dass beide etwas
sagen. Das ist dieselbe unaufgelöste Frage, die ADR-0026 bei den doppelten
Attributdefinitionen beseitigt hat – und die dort nicht durch Absicht entstanden war,
sondern durch eine Schleife. Ein Entscheidungspunkt, eine Pflegestelle.

**Zu 4 – warum als Eingabe.** Die Definitionen sind Fachdaten dieses Dienstes und bereits
versioniert. Sie in OPA zu spiegeln hieße, ein zweites Mal zu halten, was schon steht, und
den Abgleich zur laufenden Aufgabe zu machen – der Einwand, der gegen OpenFGA entschieden
hat. Als Eingabe kostet es nichts: Der Dienst hat sie zur Hand.

**Zu 6 – warum der Dienst zuschneidet.** Eine Engine, die Antworten formt, müsste die
Antwortgestalt kennen. Sie liefert eine Feldmenge; was daraus wird, ist Sache dessen, der
die Antwort baut.

## Betrachtete Alternativen

### Getrennt: Attribute per Definition, Kernfelder per Richtlinie

Der wörtlichste Weg durch §6 und §8.

**Nicht gewählt**, siehe Begründung zu 3.

### Alles in der Richtlinie

Ein Ort, klar testbar, versioniert.

**Nicht gewählt.** Die Feldsichtbarkeit wäre Code und nicht mehr über die Oberfläche
pflegbar. §6 nennt sie ausdrücklich als Teil der Attributdefinition; davon abzuweichen wäre
möglich, bräuchte aber einen Grund, und „einfacher zu bauen" ist keiner.

### Definitionen in OPAs `data`-Dokument spiegeln

Die Engine hätte sie ohne Zutun des Aufrufers.

**Nicht gewählt**, siehe Begründung zu 4. Zusätzlich müsste dafür der Schreibendpunkt
geöffnet werden, den `authz.rego` seit `PROD-058` sperrt.

### Mehrere Gruppen je Anforderung

Näher an der Wirklichkeit von Zuständigkeiten.

**Nicht gewählt**, weil nicht ausdrückbar – siehe Nachweise. Sollte es gebraucht werden,
ist es eine eigene Entscheidung über den Filterweg, nicht über das Datenmodell.

## Konsequenzen

### Positiv

- `PROD-060` schließt, und mit ihm die auffälligste Kante aus M5.3
- Eine Anforderung hängt nicht mehr an einer einzigen Person
- Feldsichtbarkeit bleibt Fachdatum und wird trotzdem an einer Stelle entschieden
- Kein zweiter Bestand, kein Abgleich, keine Öffnung der gesperrten Endpunkte

### Negativ und Risiken

- **§12 wird unmittelbar berührt, und zwar brechend.** Darf ein Aufrufer ein Feld nicht
  sehen, fehlt es in der Antwort. Ein Contract, der es als Pflichtfeld ausweist, ist dann
  falsch; wird es optional, ist das für jeden bestehenden Konsumenten eine inkompatible
  Änderung. Der Weg dafür steht bereit – die Ausnahmeliste aus
  [ADR-0027](0027-ausnahmen-von-der-kompatibilitaetsgarantie.md) –, aber **die Form der
  Antwort bei verborgenen Feldern ist noch nicht entschieden**
- **Die Gruppe ist ein Bezeichner ohne Prüfung.** Ein Tippfehler in der Spalte kostet die
  Vertretung, ohne dass ein Fehler entsteht – dieselbe Schwäche wie bei `owner`. Sie endet
  mit M6, nicht mit diesem Meilenstein
- **Die Richtlinie bekommt einen zweiten Auswertungspfad**, und `authz.rego` einen zweiten
  Eintrag in der Freigabeliste. Fehlt er, antwortet OPA mit 401 und der Dienst fail-closed –
  sichtbar, aber die Ursache steht dann in der Freigabeliste und nicht im Fehlertext
- **Die Feldmenge wird je Anfrage ausgewertet.** Anders als der Zuschnitt ist das ein
  zweiter Aufruf gegen den Sidecar. Ob beides in einen Aufruf gehört, ist offen

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Form der Antwort bei verborgenen Feldern – fehlend, `null`, oder eigenes Schema je Rolle – und die Folge für §12 | Mit der Umsetzung von Punkt 3, **vor** der Contract-Erzeugung |
| Ob Zuschnitt und Feldmenge in einem Aufruf gegen den Sidecar ermittelt werden | Wenn die Latenz gemessen ist, nicht vorher |
| Ob die Editierbarkeit je Feld demselben Weg folgt wie die Sichtbarkeit | Mit der Umsetzung von Punkt 3 |
| Woher der Anspruch `gruppen` stammt – Keycloak-Gruppen oder Organizations | Meilenstein M6, gemeinsam mit den Mandantenzugehörigkeiten |

## Nachweise

Erhoben am 2026-08-17 gegen `openpolicyagent/opa:1.19.0`.

**Eine Gruppe ist zuschneidbar, mehrere nicht.** Regel mit
`some g in input.benutzer.gruppen; g in input.requirement.gruppen`:

```
pe_fragment_error: rhs of internal.member_2 must be known
```

Mit einer skalaren Spalte dagegen:

```json
{"field":"requirement.gruppe","operator":"in","value":["team-a","team-b"]}
```

**Die Feldmenge entsteht aus den Definitionen in der Eingabe.** Dieselben zwei Definitionen,
zwei Rollen, gewöhnliche Auswertung über `POST /v1/data/anforderungen/felder/sichtbar`:

| Rollen | Ergebnis |
|---|---|
| `requirement-author` | `owner, prio, projectId, requirementType, status, tenant` |
| `controller` | dieselben **plus** `kostenschaetzung` |

`kostenschaetzung` trägt in der Definition `sichtbarFuer: ["controller"]`. Die Engine
braucht dafür keinen eigenen Bestand – die Definitionen kamen als `input`.
