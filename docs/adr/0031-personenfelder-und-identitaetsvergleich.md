# ADR-0031: Personenfelder und Identitätsvergleich

- **Status:** Angenommen
- **Datum:** 2026-08-19
- **Betrifft:** CLAUDE.md §6, §7, §8
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0024](0024-bedingungen-an-workflow-uebergaengen.md) führt die Bedingungsart
`identitaet` ein: *„Der Auslösende ist die im Feld genannte Person – etwa `owner`."* Sie ist
seit M4.3 implementiert, dokumentiert und mit Einheitstests versehen.

**Sie kann nicht erfüllt werden.** Die Auswertung vergleicht den Feldwert gegen
`ausloeser.userId`, und das ist `payload.sub` – die Subjektkennung. Seit M5.4 trägt `owner`
dagegen `benutzer.username`, also `preferred_username`. Für jeden Aufrufer, dessen Token
einen Benutzernamen führt, sind die beiden Werte verschieden.

**Aufgefallen ist es beim Lesen, nicht beim Testen.** Der Einheitstest setzt beide Seiten aus
derselben erfundenen Konstante und ist deshalb grün. Ein Integrationstest existiert nicht:
`identitaet` kommt in `zustandswechsel.integration.spec.ts` nicht vor. Eine Bedingung, die
niemand gegen echte Token ausprobiert hat, ist damit über zwei Meilensteine unbemerkt
wirkungslos geblieben.

### Was der Meilenstein eigentlich verlangt

Die Meilensteintabelle nennt für M5.5 den *Attributdatentyp „Person"* mit dem Beweisziel
„`identitaet` wird benutzbar". Der Datentyp allein leistet das nicht – er beschreibt, was ein
Feld enthält, und behebt keinen Vergleich. Umgekehrt gilt aber: Ohne ihn lässt sich nicht
prüfen, ob das in einer Bedingung genannte Feld überhaupt eine Person enthält. Beides gehört
zusammen.

### Was es nicht gibt

Kein Verzeichnis, gegen das eine Person geprüft werden könnte. Wie beim Mandanten
([ADR-0026](0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 6) und bei der
Gruppe ([ADR-0030](0030-feldebene-und-vertretung.md) Punkt 1) ist eine Person bis M6 ein
Bezeichner aus dem Token.

## Entscheidung

**1. Ein Personenfeld trägt den `preferred_username`** – denselben Begriff, den `owner` seit
M5.4 trägt.

**2. Der Auslöser führt beide Begriffe ausdrücklich.** `ausloeser` bekommt neben `userId`
(die Subjektkennung, Grundlage von `changed_by`) eine `kennung` (den Benutzernamen).
`identitaet` vergleicht gegen `kennung`, nicht gegen `userId`.

**Nicht durch Umdeutung von `userId`.** Zwei Begriffe, zwei Namen: Wer eine Kennung für den
Auditpfad braucht, soll nicht versehentlich einen Anzeigenamen bekommen, und umgekehrt.

**3. Es gibt den Attributdatentyp `person`.** Er enthält einen Benutzernamen und wird wie
`text` geprüft; seine Bedeutung liegt in der Verwendung, nicht in der Validierung.

**4. `identitaet` darf nur ein Feld nennen, das eine Person enthält** – das Kernfeld `owner`
oder ein Attribut vom Typ `person`. Geprüft beim Speichern der Workflow-Definition, wie die
Existenz eines Feldes es heute schon wird.

**5. Eine Person wird gegen nichts geprüft.** Bis M6 ist sie ein Bezeichner aus dem Token,
wie Mandant und Gruppe.

## Begründung

**Zu 1 – warum der Benutzername und nicht die Subjektkennung.** Die Kennung wäre stabiler:
Eine Umbenennung in Keycloak lässt sie unberührt. Sie ist aber nicht lesbar, und es gibt
nichts, was sie auflösen könnte – ein Verzeichnis kommt erst mit M6. Die Anforderungsliste
zeigte dann `b-1` statt eines Namens, und dieselbe Oberfläche, die eine Person auswählbar
machen soll, hätte nichts anzuzeigen.

Hinzu kommt: `owner` trägt den Benutzernamen bereits. Die Kennung zu wählen hieße, zwei
Personenbegriffe im selben Feldraum zu führen – und genau daran scheitert `identitaet` heute.

**Zu 2 – warum zwei Namen statt eines.** Der Auditpfad braucht einen stabilen Bezeichner, der
Vergleich einen lesbaren. Beides in `userId` zu legen hätte den Fehler nur verschoben: Beim
nächsten Leser wäre unklar, welcher Begriff gemeint ist, und die Verwechslung wiederholte
sich an einer anderen Stelle.

**Zu 4 – warum die Prüfung beim Speichern.** Eine Bedingung auf ein Feld, das keine Person
enthält, ist zur Laufzeit nicht falsch, sondern **nie erfüllbar** – der Übergang wäre
dauerhaft gesperrt, und niemand sähe, warum. Dieselbe Überlegung, aus der `pruefeFeldnamen`
seit M4.3 die Existenz prüft und ADR-0024 Punkt 7 die Auswertbarkeit verlangt. Der Fehler,
den dieses ADR behebt, ist die stärkste Begründung dafür: Er hat zwei Meilensteine
überlebt, weil ihn keine Prüfung sehen konnte.

## Betrachtete Alternativen

### Die Subjektkennung speichern

Stabil gegen Umbenennung.

**Nicht gewählt**, siehe Begründung zu 1. Ohne Verzeichnis nicht anzeigbar, und `owner`
müsste umgestellt werden.

### Beides speichern – Kennung zum Vergleich, Name zur Anzeige

Löst beide Nachteile.

**Nicht gewählt.** Zwei Werte je Person in einem JSONB-Feld, die auseinanderlaufen können,
und die Frage, welcher führt. Für ein Attribut ohne Verzeichnis dahinter ist das viel
Aufwand für einen Zustand, den M6 ohnehin ersetzt.

### Nur den Vergleich beheben, ohne Datentyp

Die kleinste Änderung: `identitaet` vergleicht gegen den Benutzernamen, fertig.

**Nicht gewählt.** Dann bliebe `identitaet` auf jedem Textfeld erlaubt, und eine Bedingung
auf ein Feld ohne Person wäre weiterhin eine dauerhaft gesperrte Tür ohne Hinweis. Der
Datentyp ist das, was die Prüfung aus Punkt 4 überhaupt möglich macht.

## Konsequenzen

### Positiv

- `identitaet` wirkt erstmals – und es gibt einen Integrationstest, der es gegen echte Token
  belegt
- Eine Bedingung auf ein Feld ohne Person wird beim Speichern abgewiesen, nicht zur Laufzeit
  stillschweigend unerfüllbar
- Zwei Identitätsbegriffe haben zwei Namen; die Verwechslung, die diesem ADR zugrunde liegt,
  ist nicht wiederholbar

### Negativ und Risiken

- **Eine Umbenennung in Keycloak verwaist jeden Datensatz, der den alten Namen nennt.**
  Betroffen sind `owner`, `responsible_group` und künftig jedes Personenattribut. Ohne
  Verzeichnis ist keine Migration möglich – **woran es auffiele:** an nichts. Der Datensatz
  ist für den Umbenannten schlicht nicht mehr sichtbar, und ein wiedervergebener
  Benutzername erbt dessen Zugriff. Festgehalten als
  [`PROD-065`](../operations/production-readiness.md), neben `PROD-063`
- **Der Datentyp verspricht mehr, als er prüft.** `person` wird wie `text` validiert; dass
  der Wert einen existierenden Anwender bezeichnet, weiß niemand. Der Name des Typs legt
  anderes nahe
- **Ein weiterer Wert im Datentyp-Enum** bedeutet eine Migration und eine Fallunterscheidung
  mehr in der Attributprüfung, in der Oberfläche und im Vertrag

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Ob Personenfelder zu Referenzen auf Identitäten werden – und wie der Bestand umgestellt wird | Meilenstein M6 |
| Ob `identitaet` auch gegen eine Gruppenzugehörigkeit prüfen darf („einer aus der zuständigen Gruppe") | Wenn ein Genehmigungsweg das verlangt |
| Ob die Oberfläche Personen aus einem Verzeichnis anbietet statt freier Eingabe | Meilenstein M6 |

## Nachweise

Der Befund, der dieses ADR ausgelöst hat, in drei Zeilen:

`workflows/bedingungspruefung.ts`:

```ts
    case "identitaet":
      return gleich(kontext.feldwerte[bedingung.feld], kontext.ausloeser.userId)
```

`auth/jwt.strategy.ts`:

```ts
      userId: payload.sub,
```

`requirements/requirements.service.ts`, seit M5.4:

```ts
      const verantwortlich = eingabe.owner ?? benutzer.username;
```

`username` ist `preferred_username ?? sub`. Für jedes Token mit Benutzernamen sind die
verglichenen Werte damit verschieden, und die Bedingung ist unerfüllbar.

Der Einheitstest in `test/bedingungspruefung.spec.ts` ist grün, weil sein Prüfaufbau
`feldwerte.owner` und `ausloeser.userId` aus derselben Konstante speist. In
`test/zustandswechsel.integration.spec.ts` kommt `identitaet` nicht vor.
