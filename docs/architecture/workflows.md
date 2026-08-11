# Workflows

Wie konfigurierbare Abläufe nach CLAUDE.md §7 aufgebaut sind, was geprüft wird und was
davon heute schon gilt.

> **Stand:** Definition, Durchsetzung und Bedingungen sind umgesetzt (M4.1 bis M4.3).
> **Zuständigkeiten gelten global und ohne Objektbezug**, und es gibt noch keine
> Verwaltungsoberfläche – siehe [Was heute gilt](#was-heute-gilt-und-was-nicht). Dieser
> Abschnitt ist beim Lesen der erste, nicht der letzte.

---

## Der Begriff

Ein Workflow ist ein **Zustandsgraph**: eine Menge von Zuständen und eine Menge gerichteter
Übergänge zwischen ihnen. Eine Anforderung befindet sich zu jedem Zeitpunkt in genau einem
Zustand und verlässt ihn nur über einen Übergang, der im Graphen steht.

Workflows sind **Fachdaten, nicht Code**. Ein neuer Zustand entsteht über die
Verwaltungsoberfläche, ohne dass jemand eine Zeile übersetzt oder ausrollt. Das ist die
Kernforderung aus §7 und der Grund, warum der Graph in der Datenbank liegt und nicht in
einer Konstanten.

Nicht jeder Lebenszyklus ist ein Workflow. Ein Rack, dessen Wartung ausläuft, wechselt
seinen Zustand, weil ein Datum vergeht – dort gibt es keinen Handelnden, dessen
Berechtigung zu prüfen wäre. Diese Abgrenzung trifft
[ADR-0020](../adr/0020-lebenszyklus-der-infrastruktur.md): *Maßnahme* ist ein Workflow,
*Bestandsobjekt* ist keiner.

---

## Bestandteile

| Feld | Bedeutung |
|---|---|
| `label` | Bezeichnung für Menschen |
| `requirementType` | Wofür der Workflow gilt. Leer = für alle Typen ohne eigenen |
| `mode` | Betriebsart: `internal` oder `external` – siehe unten |
| `initialState` | Zustand, in dem eine neue Anforderung beginnt |
| `states` | Die Zustände: Schlüssel, Bezeichnung, Endzustandskennzeichen |
| `transitions` | Die Übergänge: von, nach, Bezeichnung |
| `active` | `false` setzt den Workflow außer Kraft, ohne ihn zu löschen |

**Zustandsschlüssel** haben das Format `^[a-z][a-z0-9_]*$` – also `in_pruefung`, nicht
`In Prüfung`. Der Schlüssel ist ein stabiler Bezeichner, der in Adressen, in der Oberfläche
und später in der Abbildung auf das Statusvokabular des Vertrags
([ADR-0010](../adr/0010-entkopplung-anforderung-und-kapazitaet.md)) auftaucht. Die
Bezeichnung für Menschen steht in `label` und darf alles enthalten.

**Genau ein Workflow je Anforderungstyp.** Zwei Graphen für denselben Typ wären nicht
entscheidbar – die Datenbank erzwingt das über eine Eindeutigkeit, die auch den
allgemeinen Workflow einschließt (`UNIQUE NULLS NOT DISTINCT`).

### Der Graph liegt als ein Wert vor

`states` und `transitions` sind zwei JSONB-Spalten, keine eigenen Tabellen. Der Grund
liegt in der Versionierung: §7 verlangt, dass eine laufende Anforderung auf ihrer
Ursprungsfassung bleibt. Als Wert ist diese Fassung ein Zeiger auf eine Historienzeile,
und der Graph steht vollständig darin. Auf drei Tabellen verteilt müsste man ihn zu jedem
Zeitpunkt zusammensetzen.

---

## Betriebsarten

Ein Workflow kann von uns geführt werden oder von einem Fremdsystem – Jira, eine CMDB, ein
Genehmigungswerkzeug. [ADR-0021](../adr/0021-anbindung-externer-workflows.md) unterscheidet
beides:

| | `internal` | `external` |
|---|---|---|
| Wer entscheidet den Übergang | dieser Dienst | das Fremdsystem |
| Rolle des Graphen | prüft und weist ab | beschreibt |
| Übergänge nötig | ja | nein |
| Eingehender Zielzustand | wird als Übergang geprüft | wird entgegengenommen |

Ein fremdgeführter Workflow darf **gar keine Übergänge** führen. Er zählt dann nur die
Zustände auf, die das Fremdsystem kennt, damit Auswertung und Oberfläche sie benennen
können.

Der Grund für die Unterscheidung: Wiese unser Graph eine Zustandsänderung ab, die im
führenden System bereits stattgefunden hat, entstünde ein dauerhafter Widerspruch – und
unsere Seite wäre die falsche.

---

## Was beim Speichern geprüft wird

Ein widersprüchlicher Graph wird beim **Speichern** abgewiesen, nicht beim Benutzen. Wäre
es umgekehrt, stellte der Fehler eine laufende Anforderung fest – in einem Zustand, den der
Graph nicht kennt.

| Prüfung | `internal` | `external` |
|---|---|---|
| Mindestens ein Zustand | ✓ | ✓ |
| Keine doppelten Zustandsschlüssel | ✓ | ✓ |
| Anfangszustand ist ein angelegter Zustand | ✓ | ✓ |
| Übergänge zeigen auf angelegte Zustände | ✓ | ✓ |
| Kein Übergang eines Zustands auf sich selbst | ✓ | ✓ |
| Kein zweiter Übergang zwischen demselben Paar | ✓ | ✓ |
| Keine Sackgasse ohne Endzustandskennzeichnung | ✓ | – |
| Endzustand hat keinen ausgehenden Übergang | ✓ | – |

**Strukturelle Widersprüche gelten immer. Vollständigkeit verlangt nur, wer auch
entscheidet.** Bei einem fremdgeführten Graphen ohne Übergänge sähe sonst jeder Zustand wie
eine Sackgasse aus, und die Prüfung erzeugte lauter falsche Befunde.

Alle Befunde kommen in **einer** Meldung. Wer ein Formular abschickt, soll nicht siebenmal
nacheinander je einen Fehler zu sehen bekommen.

### Unerreichbare Zustände sind kein Fehler

Ein Zustand, den noch kein Übergang erreicht, macht den Graphen **unvollständig, nicht
falsch** – ein Graph im Aufbau sieht genau so aus. Die Antwort führt ihn deshalb in
`unreachableStates` als Hinweis, und das Speichern gelingt trotzdem.

Bei fremdgeführten Workflows bleibt diese Liste leer: Ohne Übergänge wäre jeder Zustand
außer dem ersten unerreichbar, und ein Hinweis, der immer erscheint, wird übersehen.

---

## Bedingungen an Übergängen

> Entschieden in [ADR-0024](../adr/0024-bedingungen-an-workflow-uebergaengen.md), umgesetzt
> mit **M4.3**.

Ein Übergang kann Bedingungen tragen. Jede Bedingung ist eine **Implikation**:

```
[ nurWenn ]  →  Anforderung
```

Fehlt `nurWenn`, gilt die Bedingung immer. Die Bedingungen eines Übergangs werden mit
**UND** verknüpft – jede muss erfüllt sein.

**Daraus folgt das ODER von selbst.** Zwei Bedingungen mit derselben Anforderung ergeben
zusammen „A oder B, dann Anforderung". Man schreibt es nicht hin, es entsteht.

### Anforderungsarten

Was verlangt sein kann. Der Wert von `art` bestimmt die übrigen Felder.

| `art` | Felder | Bedeutung |
|---|---|---|
| `rolle` | `eineVon: string[]` | Der Auslösende trägt mindestens eine dieser Realm-Rollen |
| `vier_augen` | `andersAlsBeiEintritt: string` | Der Auslösende ist **nicht** die Person, die den Eintritt in diesen Zustand ausgelöst hat |
| `identitaet` | `feld: string` | Der Auslösende ist die im Feld genannte Person – etwa `owner` |
| `pflichtfelder` | `felder: string[]` | Diese Felder sind gefüllt |
| `feldwert` | `feld: string` + ein Vergleich | Das Feld erfüllt den Vergleich |
| `begruendung` | `mindestlaenge?: number` | Der Vorgang führt eine Begründung mit; sie landet in `change_reason` |

**„Nicht der Ersteller" braucht keine eigene Art.** Der Anfangszustand wird beim Anlegen
betreten – `vier_augen` mit Verweis auf ihn trifft den Ersteller.

### Vergleiche

Ein Vergleich hat immer dieselbe Gestalt – `{ feld, operator, wert }`. Verwendbar in
`nurWenn` und in `feldwert`.

| `operator` | Bedeutung | `wert` |
|---|---|---|
| `istGleich` | Wert stimmt überein | beliebig |
| `istUngleich` | Wert stimmt nicht überein | beliebig |
| `mindestens` | Zahl oder Datum größer oder gleich | Zahl oder Zeichenkette |
| `hoechstens` | Zahl oder Datum kleiner oder gleich | Zahl oder Zeichenkette |
| `istEinesVon` | Wert kommt in der Liste vor | Liste |
| `istGefuellt` | Feld ist gesetzt und nicht leer | `true` oder `false` |

Die drei Felder statt des Operators als Schlüssel sind Absicht: Jeder Vergleich ist gleich
gebaut, in M4.6 mit drei Eingabefeldern bedienbar, und ein neuer Operator ist ein Wert in
der Aufzählung plus ein Fall im Prüfer – ohne Sonderlogik dafür, welcher Schlüssel gesetzt
sein darf.

**Ein Vergleich, der sich nicht auswerten lässt, weist ab.** Steht in
`kostenschaetzung` eine Zeichenkette und der Vergleich lautet `mindestens 50000`, ist das
Ergebnis weder wahr noch falsch – der Übergang scheitert mit dieser Begründung. Zu raten
wäre schlimmer, in beide Richtungen.

**Kein ODER, keine Klammern, keine Verschachtelung innerhalb einer Regel.** `nurWenn` ist
eine Liste von Vergleichen, die alle gelten müssen. Wer mehr braucht, schreibt eine zweite
Bedingung.

### Beispiel

> Freigeben darf die Rolle *Freigeber*, aber nicht dieselbe Person, die eingereicht hat.
> Ab 50.000 € oder bei Abweichung vom Standard kommt die Architekturfreigabe dazu – außer
> in der Cloud. Eine Abweichung ist zu begründen.

```jsonc
{
  "from": "in_pruefung", "to": "freigegeben", "label": "Freigeben",
  "bedingungen": [
    { "art": "rolle", "eineVon": ["freigeber"] },
    { "art": "vier_augen", "andersAlsBeiEintritt": "in_pruefung" },

    { "art": "rolle", "eineVon": ["architektur-freigeber"],
      "nurWenn": [
        { "feld": "kostenschaetzung", "operator": "mindestens", "wert": 50000 },
        { "feld": "kategorie", "operator": "istUngleich", "wert": "cloud" }
      ] },

    { "art": "rolle", "eineVon": ["architektur-freigeber"],
      "nurWenn": [
        { "feld": "standardkonform", "operator": "istGleich", "wert": false },
        { "feld": "kategorie", "operator": "istUngleich", "wert": "cloud" }
      ] },

    { "art": "pflichtfelder", "felder": ["abweichungsbegruendung"],
      "nurWenn": [{ "feld": "standardkonform", "operator": "istGleich", "wert": false }] }
  ]
}
```

Jede der fünf Zeilen lässt sich als Satz vorlesen. **Das ist der Maßstab:** Entsteht eine
Regel, die für sich gelesen nichts bedeutet – ein Bruchstück, das nur existiert, weil ein
UND über ein ODER verteilt wurde –, bildet die Liste nicht mehr die Fachlichkeit ab,
sondern ihre ausmultiplizierte Form. Dann, und erst dann, ist eine Regel-Engine fällig.

### Was geprüft wird und wann

| | wann | wo |
|---|---|---|
| Passen Operator und Wert zusammen? | beim Speichern | `pruefeGraph` |
| Verweist `vier_augen` auf einen vorhandenen Zustand? | beim Speichern | `pruefeGraph` |
| **Liegt der Vier-Augen-Bezug auf jedem Weg dorthin?** | beim Speichern | `pruefeGraph` |
| **Trägt ein fremdgeführter Workflow Bedingungen?** | beim Speichern | `pruefeGraph` – abgewiesen |
| Gibt es die genannten Felder? | beim Speichern | Service – die Attributdefinitionen sind Laufzeitdaten, `pruefeGraph` kennt sie nicht |
| Sind die Bedingungen erfüllt? | beim Übergang | Service |

**Eine Bedingung, die sich nicht auswerten lässt, gilt als nicht erfüllt.** Fehlt ein Feld
oder ist ein Wert nicht vergleichbar, scheitert der Übergang. Im Zweifel durchzulassen
hieße, eine Genehmigungsstrecke zu haben, die genau dann nachgibt, wenn etwas nicht stimmt.

Die beiden hervorgehobenen Prüfungen sind beim Umsetzen dazugekommen und stehen so nicht
in ADR-0024:

**Der Vier-Augen-Bezug muss den Ausgangszustand beherrschen** – er muss auf *jedem* Weg
vom Anfangszustand dorthin liegen. Sonst gibt es einen Pfad, auf dem ihn niemand ausgelöst
hat; dort griffe die Prüfung ins Leere und der Übergang wäre dauerhaft gesperrt. Ermittelt
wird das mit einer gewöhnlichen Dominatorberechnung über den Graphen.

**Ein fremdgeführter Workflow darf keine Bedingungen tragen.** Dort entscheidet das
Fremdsystem (ADR-0021 Punkt 4); eine Bedingung würde nie ausgewertet und sähe trotzdem aus
wie eine Zusicherung. Dasselbe Argument wie bei den Vollständigkeitsprüfungen aus M4.1, nur
in die andere Richtung.

### Vergleiche gegen Daten anderer Dienste

Ob eine Bestellung von einer **Standardgröße** abweicht, steht im Service-Typ-Katalog des
Infrastructure Service (§18) – nicht hier. Eine Bedingung liest ihn **nicht** zur Laufzeit;
[ADR-0021](../adr/0021-anbindung-externer-workflows.md) schließt synchrone Aufrufe in
Übergängen aus.

Stattdessen hält der Erfassungsweg den Befund als Feld an der Anforderung fest:

```jsonc
"dynamicAttributes": {
  "servicetyp": "kubernetes-cluster",
  "groesse": "custom-192gb",
  "standardkonform": false,
  "abweichungsbegruendung": "Speicherbedarf der Analysedatenbank"
}
```

Das ist nicht der Umweg, sondern der richtige Weg: Der Befund ist damit **versioniert**. Ob
eine Anforderung im März 2027 als standardkonform galt, ist eine Stichtagsabfrage – auch
dann noch, wenn der Katalog sich seither geändert hat.

### Wo die Grenze des Konfigurierbaren liegt

| | ohne Redeploy |
|---|---|
| Bedingungen zusammenstellen, Rollen, Schwellen, Felder, Vorbehalte ändern | **ja** |
| Eine neue `art` oder einen neuen Vergleich einführen | **nein** – Prüfer, Meldung und Bedienelement sind Code |

Derselbe Schnitt wie bei den Attributdatentypen nach
[ADR-0016](../adr/0016-ui-grundlage-und-datenzugriff-im-frontend.md): Der Administrator
komponiert frei innerhalb des Vokabulars, ein neues Vokabel ist Code.

Deshalb entsteht das Vokabular oben **vollständig mit M4.3**, auch die Arten, für die es
heute keinen Anwendungsfall gibt. Der Preis dafür steht in ADR-0024: Eine nie benutzte Art
ist im Betrieb ungeprüft, und jede entsteht deshalb mit eigenem Test.

---

## Versionierung

Jede Änderung einer Workflow-Definition erzeugt eine neue Version, geschrieben in derselben
Transaktion ([ADR-0012](../adr/0012-vollstaendige-versionierung-mit-zeitbezug.md)). Die
Fachtabelle führt den aktuellen Stand, `workflow_definition_history` alle Fassungen mit
`valid_from`/`valid_to`.

Eine Fassung trägt den **vollständigen Graphen**, nicht die Änderung gegenüber der
nächsten. Nur deshalb kann eine laufende Anforderung an ihre Ursprungsfassung gebunden
werden (M4.4).

**Das ist der beabsichtigte Gegensatz zu den Attributdefinitionen.** Die werden gegen die
*aktuell gültige* Fassung geprüft; Workflow-Definitionen gelten für eine laufende
Anforderung in der Fassung, unter der sie gestartet ist. Ein nachträglich geänderter Graph
würde sonst Anforderungen in Zustände versetzen, die es zu ihrer Zeit nicht gab.

Ein Workflow wird **nie gelöscht**, nur über `active` außer Kraft gesetzt. Laufende
Anforderungen verweisen auf ihn.

---

## Wie ein Statuswechsel abläuft

> Entschieden in [ADR-0022](../adr/0022-statuswechsel-als-eigener-vorgang.md), umgesetzt
> mit **M4.2**. Über `PUT /v1/requirements/by-source/{sourceSystem}/{externalId}/state`.

**Der Statuswechsel ist ein eigener Vorgang.** `status` ist kein Feld, das man nebenbei
mitschickt: Weder das Anlegen noch das Ändern einer Anforderung setzt ihn.

1. **Jede Anforderung hat einen Workflow.** Gibt es für ihren Typ weder einen typbezogenen
   noch einen allgemeinen gültigen Workflow, entsteht sie nicht.
2. **Der Anfangszustand kommt aus der Definition.** Deshalb entfällt `status` beim Anlegen.
3. **Ein Wechsel benennt einen Übergang** des geltenden Graphen. Bei eigengeführten
   Workflows genügt der Zielzustand: Aus aktuellem und gewünschtem Zustand ergibt sich der
   Übergang eindeutig, weil doppelte Übergänge ausgeschlossen sind.
4. **Fremdgeführte Workflows nehmen den Zielzustand entgegen.** Geprüft wird nur, dass er
   im Graphen vorkommt.
5. **Außer Kraft gesetzt heißt „keiner", nicht „der allgemeine".** Es gibt keinen stillen
   Rückfall auf einen anderen Graphen.

### Wenn die Anforderungsart wechselt

`requirementType` bestimmt, welcher Workflow gilt. Ändert er sich, wird die Anforderung an
den Workflow der neuen Art gebunden – in dessen aktueller Fassung
([ADR-0023](../adr/0023-workflow-bindung-beim-typwechsel.md)). Gibt es dafür keinen
gültigen Workflow, wird der Wechsel abgewiesen.

Der Zustand wird dabei **nicht** angepasst. Kommt er im neuen Graphen nicht vor, gilt der
nächste Abschnitt.

### Wenn der aktuelle Zustand im Graphen nicht vorkommt

Das kann entstehen, wenn eine Anforderung älter ist als ihr Workflow, wenn ein Import einen
fremden Status geliefert hat oder wenn ein Zustand aus der Definition entfernt wurde.

Dann wird jeder Übergang abgewiesen – **mit dem konkreten Grund**, nicht mit „Übergang
unzulässig". Lesen bleibt möglich. Aufgelöst wird es über den Verwaltungsvorgang
**„Zustand zuordnen"**, der einen Zustand des Graphen setzt und eine Begründung verlangt.

Der Zustand wird dabei **nicht stillschweigend zurückgesetzt**. Eine Anforderung, die
„freigegeben" war, auf den Anfangszustand zu setzen, schriebe Geschichte um – und der
Nachweiszweck der Historie wäre dahin.

### Importe laufen denselben Weg

§19.2 verlangt drei gleichrangige Eingangswege durch denselben Verarbeitungspfad. Ein
Import schreibt den Status deshalb **nicht** direkt, sondern durchläuft dieselbe Prüfung
wie die Oberfläche. Findet sich kein Übergang, wird abgewiesen – bei automatischer Herkunft
festgehalten statt zurückgemeldet
([ADR-0019](../adr/0019-verhalten-bei-abgewiesener-schreiboperation.md)).

---

## Was heute gilt und was nicht

| | Stand |
|---|---|
| Workflows anlegen, ändern, versionieren | **umgesetzt** (M4.1) |
| Graph wird auf Widersprüche geprüft | **umgesetzt** (M4.1) |
| Statuswechsel läuft gegen den Graphen | **umgesetzt** (M4.2) |
| Anforderung ist an eine Workflow-Fassung gebunden | **umgesetzt** (M4.2) |
| Bedingungen an Übergängen: Pflichtfelder, Berechtigung, Vier-Augen | **umgesetzt** (M4.3) |
| Was gilt, wenn die gebundene Fassung den Zustand nicht mehr führt | offen (M4.4) |
| Übergänge als Schaltflächen in der Oberfläche | offen (M4.5) |
| Verwaltungsoberfläche für Workflows | offen (M4.6) |

**Der Ablauf erzwingt seit M4.3 Reihenfolge und Zuständigkeit.** Damit ist `PROD-052`
geschlossen: Ein Übergang kann eine Rolle verlangen, das Vier-Augen-Prinzip durchsetzen,
Pflichtfelder und Feldwerte prüfen und eine Begründung fordern.

**Zwei Einschränkungen bleiben, und beide sehen harmloser aus, als sie sind:**

- **Die Rolle am Übergang gilt global.** „Freigeber" heißt „Freigeber überall", nicht
  „Freigeber für dieses Projekt". Der Objektbezug aus §8 kommt mit M5 – geführt unter
  `PROD-017`. Wer einen Genehmigungsablauf konfiguriert, hat keinen Anlass zu vermuten,
  dass die Rolle für sämtliche Projekte gilt.
- **Workflows werden über die API gepflegt, nicht über eine Oberfläche** – `PROD-054`.
  Fachlich ändert das nichts, die Definitionen sind Fachdaten und wirken ohne Redeploy.
  Aber §7 meint mit „konfigurierbar" nicht „von Hand im Editor": Ein Ablauf, den nur ändern
  kann, wer JSON und das Vokabular beherrscht, wird faktisch von der Entwicklung gepflegt.

---

## Wo der Code liegt

| Datei | Inhalt |
|---|---|
| `services/requirement/src/workflows/typen.ts` | Begriffe – hängt von nichts ab |
| `services/requirement/src/workflows/graph-pruefung.ts` | Die Prüfungen als reine Funktionen |
| `services/requirement/src/workflows/workflows.repository.ts` | Versionierter Schreibpfad |
| `services/requirement/src/workflows/workflows.service.ts` | Prüfung, Zuordnung auf den API-Typ |
| `services/requirement/test/graph-pruefung.spec.ts` | Prüfungen einzeln |
| `services/requirement/test/workflows.integration.spec.ts` | Gegen die echte Datenbank |

**Die Prüf- und Übergangslogik kennt weder NestJS noch die Datenbank**, und `schema.ts`
importiert von dort, nicht umgekehrt. Nach ADR-0020 Punkt 9 bekommt die Workflow-Maschine
mit M6 einen zweiten Konsumenten im Infrastructure Service; mit dieser
Abhängigkeitsrichtung ist die Herauslösung nach `packages/` ein Verschieben von Dateien.

---

## Verweise

| Dokument | Inhalt |
|---|---|
| [ADR-0012](../adr/0012-vollstaendige-versionierung-mit-zeitbezug.md) | Versionierung und Zeitbezug |
| [ADR-0020](../adr/0020-lebenszyklus-der-infrastruktur.md) | Maßnahme und Bestandsobjekt – wo ein Workflow passt und wo nicht |
| [ADR-0021](../adr/0021-anbindung-externer-workflows.md) | Anbindung externer Workflows, Betriebsarten |
| [ADR-0022](../adr/0022-statuswechsel-als-eigener-vorgang.md) | Statuswechsel als eigener Vorgang, Pflicht zum Workflow |
| [ADR-0023](../adr/0023-workflow-bindung-beim-typwechsel.md) | Neubindung beim Wechsel der Anforderungsart |
| [ADR-0024](../adr/0024-bedingungen-an-workflow-uebergaengen.md) | Bedingungen an Übergängen, Vokabular statt Regel-Engine |
| [`README.md`](README.md#m4-im-detail) | Meilensteinzuschnitt M4 |
| [`production-readiness.md`](../operations/production-readiness.md) | `PROD-052` |
