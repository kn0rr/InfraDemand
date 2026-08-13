# ADR-0027: Ausnahmen von der Kompatibilitätsgarantie

- **Status:** Angenommen
- **Datum:** 2026-08-13
- **Betrifft:** CLAUDE.md §12, §14
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§12 verlangt versionierte Lese-APIs mit Kompatibilitätsgarantie. Seit M1 setzt das ein Tor
in der CI durch: `oasdiff breaking … --fail-on ERR` vergleicht den erzeugten Contract gegen
den Stand im Zielbranch.

Seither ist es dreimal grün geblieben, obwohl eine inkompatible Änderung vorlag, und einmal
rot aus einem anderen Grund als dem beabsichtigten – die vier Fälle stehen in `PROD-049`.
**Der umgekehrte Fall trat mit M5.1 zum ersten Mal ein:**

```
error [new-required-request-property] in API POST /v1/requirements
      added the new required request property `tenant`
```

Die Einstufung ist richtig. `tenant` ist nach
[ADR-0026](0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 3 Pflicht ohne
Vorgabewert; jeder Aufrufer, der ihn nicht sendet, erhält 400. Das ist eine inkompatible
Änderung, und das Tor sagt es.

**Es gibt nur keinen Weg, ja zu sagen.** Das Tor kennt zwei Zustände: durchlassen oder
blockieren. Ohne einen dritten bleibt bei einer bewusst gewollten inkompatiblen Änderung
nur, den Schritt abzuschalten oder die Fachlichkeit zu verbiegen.

Der ADR-Index führt dazu eine vertagte Frage: *„Ab wann die Kompatibilitätsgarantie aus §12
gilt – und wie eine begründete Ausnahme davor aussieht"*, vertagt **„vor dem ersten
Produktivgang"**. Das ist eine Frist, die nichts auslöst. Der Vorgang, der sie auslösen
sollte, ist inzwischen eingetreten – wie schon bei zwei Einträgen, deren Frist M4.3
unbemerkt verstrich.

## Entscheidung

**1. Die Kompatibilitätsgarantie aus §12 beginnt mit dem ersten Konsumenten außerhalb
dieses Repositories.** Bis dahin ist eine inkompatible Änderung zulässig – aber nicht
stillschweigend.

**2. Das Tor bleibt unverändert scharf.** `--fail-on ERR` wird weder abgeschaltet noch
aufgeweicht, und keine Prüfregel wird in ihrer Einstufung herabgesetzt.

**3. Eine inkompatible Änderung wird durch einen Eintrag in
`.github/oasdiff-ausnahmen.txt` zugelassen**, übergeben mit `--err-ignore`. Je Ausnahme
genau eine Zeile, die genau eine Änderung benennt: Verfahren, Pfad und der Meldungstext.

**4. Über jeder Zeile steht als Kommentar, wer sie wann und warum eingetragen hat** –
Datum, Meilenstein und der Grund in einem Satz. Kommentarzeilen wirken nicht als
Freibrief; sie treffen auf keine Meldung zu.

**5. Der Mechanismus endet mit Punkt 1.** Sobald ein Konsument außerhalb dieses
Repositories besteht, wird die Datei geleert, und eine inkompatible Änderung verlangt
stattdessen eine neue Version der Schnittstelle.

## Begründung

**Warum nicht den Schritt abschalten.** Ein Tor, das einmal abgeschaltet wurde, wird wieder
abgeschaltet – und `PROD-049` zeigt, dass dieses ohnehin weniger abdeckt, als sein grüner
Haken nahelegt. Wer es zusätzlich schwächt, behält einen Haken ohne Aussage. Das ist
schlechter als kein Tor, weil es Vertrauen für einen Bereich erzeugt, den es nicht prüft.

**Warum eine Datei im Repository und kein Schalter am Lauf.** Eine Zeile in einer
versionierten Datei erscheint im Diff, verlangt eine Begründung und wird im Review gelesen.
Ein Kommandozeilenschalter oder eine PR-Markierung hinterlässt nichts, was ein Jahr später
noch auffindbar wäre. Es ist dieselbe Überlegung, aus der es diese ADRs überhaupt gibt.

**Warum eine Ausnahme je Änderung und keine Regelabschaltung.** `oasdiff` böte mit
`--severity-levels` an, die Prüfregel `new-required-request-property` dauerhaft
herabzustufen. Das entschärfte sie für **jeden künftigen Fall**, nicht für diesen. Der
Unterschied ist der zwischen „diese eine Änderung ist gewollt" und „solche Änderungen
interessieren uns nicht mehr".

**Warum der erste Konsument und kein Datum.** Ein Datum löst nichts aus; das ist an zwei
vertagten Entscheidungen bereits vorgeführt worden, deren Frist niemand bemerkte. Ein
Konsument außerhalb dieses Repositories ist ein beobachtbares Ereignis – und zugleich
genau der Zeitpunkt, ab dem die Garantie überhaupt jemandem etwas nützt.

**Die Genauigkeit des Mechanismus ist geprüft, nicht angenommen.** Siehe Nachweise.

## Betrachtete Alternativen

### Den CI-Schritt vorübergehend abschalten

Ein Kommentarzeichen vor dem Schritt, ein Hinweis im PR.

**Nicht gewählt.** Es hinterlässt keine Spur im Ergebnis und keine Begründung an der
Änderung. Wer den Schritt später wieder einschaltet, weiß nicht, was in der Zwischenzeit
durchgelaufen ist – und ob er noch eingeschaltet wird, hängt an einer Erinnerung.

### `tenant` optional machen, mit Rückfallwert

Die inkompatible Änderung entfiele.

**Nicht gewählt.** [ADR-0026](0026-wirksamer-mandant-und-stufung-der-konfiguration.md)
Punkt 3 verwirft einen Vorgabewert ausdrücklich: „Ein Wert wie ‚standard' wäre ein
erfundener Mandant." Eine Entscheidung zurückzunehmen, um ein Tor zu passieren, kehrt das
Verhältnis von Fachlichkeit und Werkzeug um.

### Neue Pfadversion `/v2/requirements`

Der bestehende Contract bliebe unberührt.

**Nicht gewählt.** Die Garantie gilt gegenüber niemandem – außer dem eigenen Frontend
besteht kein Konsument. Zwei Pfade zu pflegen, um einen Aufrufer zu schonen, den es nicht
gibt, ist Aufwand ohne Empfänger. Ab Punkt 1 ist es die richtige Antwort.

### Die Prüfregel dauerhaft herabstufen

`--severity-levels` mit `new-required-request-property: warn`.

**Nicht gewählt**, siehe Begründung.

## Konsequenzen

### Positiv

- Das Tor bleibt für alles scharf, was nicht ausdrücklich benannt ist
- Jede inkompatible Änderung wird zu einer gelesenen Zeile mit Begründung, statt zu einem
  abgeschalteten Schritt
- Die vertagte Frage aus dem ADR-Index ist beantwortet – durch einen Mechanismus und ein
  Ereignis statt durch eine Frist
- Der Mechanismus hat ein festgelegtes Ende und wird nicht zur Dauereinrichtung

### Negativ und Risiken

- **Ein stehengebliebener Eintrag verdeckt eine wortgleiche Wiederholung.** Würde `tenant`
  später entfernt und erneut als Pflichtfeld eingeführt, bliebe die alte Zeile wirksam und
  das Tor stumm. Das Fenster ist eng – die Zeile trifft nur bei identischem Verfahren,
  Pfad und Meldungstext –, aber es ist offen. **Woran es auffiele:** an nichts. Deshalb
  tragen die Einträge ein Datum, und deshalb endet der Mechanismus mit Punkt 1
- **Kein Konsument wird benachrichtigt.** Die Datei ist bis auf Weiteres das einzige
  Verzeichnis inkompatibler Änderungen. Ein Änderungsprotokoll fehlt und wird mit dem
  ersten Konsumenten gebraucht
- **Der Mechanismus wirkt nur, solange die Zeile gelesen wird.** Eine Ausnahme im Diff, die
  im Review durchgewinkt wird, ist so gut wie keine. Das gilt für ADRs gleichermaßen und
  ist keine neue Abhängigkeit

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Änderungsprotokoll für den Contract – Form und Ablage | Mit dem ersten Konsumenten außerhalb dieses Repositories |
| Versionierungsschema der Schnittstelle: Pfad, Kopffeld oder Medientyp | Wenn die erste Ausnahme nicht mehr zulässig ist (Punkt 5) |
| Ob dieselbe Ausnahmeform für weitere Verträge gilt, sobald es mehrere Dienste gibt | Meilenstein M6 |

## Nachweise

`tufin/oasdiff:v1.27.0`, Vergleich des Standes vor M5.1 gegen den erzeugten Contract.

**Der Befund, der diese Entscheidung ausgelöst hat:**

```
1 changes: 1 error, 0 warning, 0 info
error	[new-required-request-property] at /rev/requirement.openapi.yaml
	in API POST /v1/requirements
		added the new required request property `tenant`
```

**Wirksamkeit und Genauigkeit der Ausnahmedatei**, drei Läufe gegen denselben Vergleich:

| Inhalt der Ausnahmedatei | Ergebnis |
|---|---|
| `api POST /v1/requirements added the new required request property \`tenant\`` | keine Meldung, Rückgabewert 0 |
| nur eine Kommentarzeile | Meldung bleibt, Rückgabewert 1 |
| dieselbe Zeile mit `mandant` statt `tenant` | Meldung bleibt, Rückgabewert 1 |

Die beiden letzten Läufe sind der eigentliche Nachweis: Eine Ausnahme deckt genau die
benannte Änderung und nichts sonst. Ohne sie wäre unbelegt, ob die Datei das Tor
entschärft oder abschaltet.
