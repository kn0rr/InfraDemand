# ADR-0023: Workflow-Bindung beim Wechsel der Anforderungsart

- **Status:** Angenommen
- **Datum:** 2026-08-11
- **Betrifft:** CLAUDE.md §7
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0022](0022-statuswechsel-als-eigener-vorgang.md) Punkt 2 legt fest, dass jede
Anforderung jederzeit einen Workflow hat, und bindet sie beim Anlegen an eine bestimmte
Fassung. Welcher Workflow gilt, folgt aus `requirementType`.

`requirementType` ist über `PATCH` änderbar. Beim Umschreiben der Tests zu M4.2 fiel auf,
dass die Bindung dabei stehen bleibt: Eine Anforderung, die von `feature` auf `bug`
wechselt, läuft weiter unter dem Graphen für `feature` – dauerhaft, und an keiner Stelle
sichtbar.

Damit stimmt die Zusicherung aus ADR-0022 Punkt 2 nach einem Typwechsel nicht mehr. Der
Fall war dort nicht bedacht.

## Entscheidung

**1. Ein Wechsel von `requirementType` bindet die Anforderung neu** – an den Workflow, der
für die neue Art gilt, in dessen aktueller Fassung.

**2. Gibt es für die neue Art keinen gültigen Workflow, wird der Wechsel abgewiesen** (400).
Er würde die Anforderung ohne Graphen zurücklassen.

**3. Der Zustand wird dabei nicht angepasst.** Kommt er im neuen Graphen nicht vor, greift
[ADR-0022](0022-statuswechsel-als-eigener-vorgang.md) Punkt 5: Der nächste Übergang wird
mit der dafür vorgesehenen Meldung abgewiesen, und ein Administrator ordnet zu.

**4. Die neue Bindung zeigt auf die aktuelle Fassung**, nicht auf eine gleichalte. Die
Anforderung beginnt unter der neuen Art neu; eine Fassung von damals wäre eine willkürliche
Wahl.

## Begründung

**Warum neu binden und nicht den Typwechsel verbieten.** Ein Verbot wäre die einfachere
Regel, aber eine falsch erfasste Art ist ein gewöhnlicher Fehler, und die dynamischen
Attribute werden bei einem Typwechsel bereits gegen die neue Art geprüft (§6). Der
Workflow anders zu behandeln als die Attribute wäre ohne Grund uneinheitlich.

**Warum der Zustand nicht mitgezogen wird.** Ihn auf den Anfangszustand des neuen Graphen
zu setzen, hieße Geschichte umzuschreiben – dieselbe Überlegung, aus der ADR-0022 Punkt 5
das Zurücksetzen ablehnt. Ihn auf einen ähnlichen Zustand abzubilden setzte eine
Entsprechung voraus, die niemand erklärt hat. Der vorhandene Weg – benennen und zuordnen
lassen – deckt den Fall bereits ab.

**Warum die Abweisung bei fehlendem Workflow.** Sie ist die Folge von ADR-0022 Punkt 2.
Ließe man den Wechsel zu, entstünde genau der Zustand, den Punkt 2 ausschließt – nur
nachträglich statt beim Anlegen.

## Betrachtete Alternativen

### Bindung unverändert lassen

Kein Sonderfall im Schreibpfad, kein zusätzlicher Lesezugriff.

**Nicht gewählt.** Die Anforderung liefe unter dem Graphen einer Art, die sie nicht mehr
hat. Das fällt niemandem auf: Der Zustand bleibt gültig, die Übergänge funktionieren, nur
sind es die falschen. Ein Fehler, der sich nicht bemerkbar macht, ist der teuerste.

### Typwechsel verbieten

Klarste Regel, keine Folgefragen.

**Nicht gewählt.** Eine falsch erfasste Art wäre dann nur durch Neuanlage korrigierbar –
und die zerstört die Historie des Datensatzes, die nach ADR-0012 gerade der Nachweis ist.

### Zustand auf den Anfangszustand des neuen Graphen setzen

Die Anforderung wäre nach dem Wechsel sofort wieder handlungsfähig.

**Nicht gewählt.** Eine Anforderung, die „erledigt" war, stünde danach auf „neu", ohne dass
jemand das entschieden hat.

## Konsequenzen

### Positiv

- Die Zusicherung aus ADR-0022 Punkt 2 gilt auch nach einem Typwechsel
- Kein neuer Mechanismus: Der Folgefall – Zustand nicht im neuen Graphen – wird von
  ADR-0022 Punkt 5 bereits behandelt

### Negativ und Risiken

- **Ein Typwechsel kann eine Anforderung handlungsunfähig machen**, bis ein Administrator
  ihren Zustand zuordnet. Das ist sichtbar und behebbar, aber es trifft den, der den
  Wechsel vornimmt, womöglich unvorbereitet. Die Oberfläche sollte beim Wechsel darauf
  hinweisen – nachzuziehen mit M4.5
- **Der Wechsel erzeugt einen Sprung in der Auswertung**: Vor und nach dem Wechsel gelten
  unterschiedliche Zustandsräume. Für Auswertungen über Zeitverläufe (§10, §11) ist das zu
  berücksichtigen
- **Ein automatischer Import kann den Typ wechseln** und damit die Bindung verschieben,
  ohne dass es jemand beabsichtigt hat. Die Hoheitsregeln nach ADR-0017 greifen auf
  `requirementType` und sind das Mittel dagegen – wer das verhindern will, setzt dort eine
  Regel
