# Workflows

Wie konfigurierbare Abläufe nach CLAUDE.md §7 aufgebaut sind, was geprüft wird und was
davon heute schon gilt.

> **Stand:** Definition und Durchsetzung des Graphen sind umgesetzt (M4.1, M4.2). **Wer
> einen Übergang nehmen darf, wird noch nicht geprüft** – siehe
> [Was heute gilt](#was-heute-gilt-und-was-nicht). Dieser Abschnitt ist beim Lesen der
> erste, nicht der letzte.

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
| Bedingungen an Übergängen: Pflichtfelder, Berechtigung | offen (M4.3) |
| Was gilt, wenn die gebundene Fassung den Zustand nicht mehr führt | offen (M4.4) |
| Übergänge als Schaltflächen in der Oberfläche | offen (M4.5) |

**Der Graph gilt, die Bedingungen an den Übergängen noch nicht.** Ein Statuswechsel läuft
seit M4.2 gegen den Zustandsgraphen, und `status` lässt sich über den allgemeinen
Schreibpfad nicht mehr setzen. **Wer einen Übergang nehmen darf, wird aber noch nicht
geprüft** – jeder angemeldete Benutzer kann jeden Übergang auslösen, den der Graph
hergibt.

Damit bleibt `PROD-052` offen: §7 sieht an Übergängen Berechtigungen, Pflichtfelder und
das Vier-Augen-Prinzip vor. Ein Ablauf, der die Reihenfolge erzwingt, aber nicht die
Zuständigkeit, sieht aus wie eine Genehmigungsstrecke und ist keine. **Bis M4.3 darf kein
Betrieb mit echten Genehmigungsanforderungen stattfinden**, auch kein Pilotbetrieb.

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
| [`README.md`](README.md#m4-im-detail) | Meilensteinzuschnitt M4 |
| [`production-readiness.md`](../operations/production-readiness.md) | `PROD-052` |
