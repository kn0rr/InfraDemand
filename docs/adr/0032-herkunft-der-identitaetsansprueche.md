# ADR-0032: Herkunft der Identitätsansprüche

- **Status:** Angenommen
- **Datum:** 2026-08-21
- **Betrifft:** CLAUDE.md §5, §8, §15
- **Ersetzt:** [ADR-0031](0031-personenfelder-und-identitaetsvergleich.md) Punkt 1 (ab M6)
- **Ersetzt durch:** –

## Kontext

Drei vertagte Fragen aus M5 laufen auf dieselbe Entscheidung hinaus, und das Register sagt es
bei zweien bereits selbst:

| Frage | Vertagt in |
|---|---|
| Woher die Mandantenzugehörigkeiten im Token stammen | [ADR-0026](0026-wirksamer-mandant-und-stufung-der-konfiguration.md) |
| Woher der Anspruch `gruppen` stammt | [ADR-0030](0030-feldebene-und-vertretung.md) |
| Woher Zuständigkeit je Bereich und Person kommt – und damit `PROD-017` | [ADR-0029](0029-zuschnitt-der-zustaendigkeit.md) |

Alle drei fragen: **Welches Konstrukt trägt eine Zugehörigkeit, und was davon steht im
Token?**

An derselben Stelle hängen zwei offene Einträge der Produktionsreife.
[`PROD-063`](../operations/production-readiness.md): `owner` und `responsible_group` sind
ungeprüfte Textspalten – ein Tippfehler ist von einer gültigen Angabe nicht zu unterscheiden.
[`PROD-065`](../operations/production-readiness.md): Eine Umbenennung in Keycloak verwaist
jeden Datensatz, der den Namen nennt, und ein wiedervergebener Name **erbt den Zugriff des
Vorgängers**. Beides ist nicht durch besseren Code zu beheben, sondern nur dadurch, dass die
Plattform etwas Stabileres speichert als einen Namen.

### Was heute läuft

Weder Gruppen noch Organizations. `tenants` und `groups` sind **mehrwertige
Benutzerattribute**, ausgelesen über `oidc-usermodel-attribute-mapper`. Eine Zugehörigkeit ist
damit eine Zeichenkette am Benutzer, ohne Gegenstück, ohne Verwaltung und ohne Prüfung.

## Entscheidung

**1. Mandant, Gruppe und Person sind Fachobjekte des Identity & Access Service** (§5) und
tragen einen **unveränderlichen Bezeichner**, der nicht ihr Name ist.

**2. Die Plattform speichert in ihren Fachdaten ausschließlich diese Bezeichner.** Namen
werden zur Anzeige aufgelöst, nie gespeichert. Das gilt für `tenant`, `owner`,
`responsible_group` und jedes Attribut vom Typ `person`.

**3. Keycloak bleibt die Quelle der Zugehörigkeit, und zwar über Keycloak-Gruppen.**
Mandantenzugehörigkeit, zuständige Gruppe und Bereich werden als Gruppen geführt – ein
Mechanismus, nicht drei.

**4. Keycloak-Organizations werden nicht eingeführt.** Begründung unten, gestützt auf
Messungen am laufenden System (Abschnitt „Nachweise").

**5. Die Abbildung von Name auf Bezeichner pflegt der Identity & Access Service aus der
Admin-API, nicht aus dem Token.** Das Token trägt weiterhin Namen beziehungsweise Pfade – mehr
kann der Gruppen-Mapper nicht. Die Stabilität entsteht **nicht im Token**, sondern in der
Abbildung dahinter: Eine Umbenennung ändert dort den Pfad zum unveränderten Bezeichner.

**6. Benutzerattribute enden in dieser Rolle.** `tenants` und `groups` als Attribut entfallen
mit der Umstellung.

**7. [ADR-0031](0031-personenfelder-und-identitaetsvergleich.md) Punkt 1 wird abgelöst.**
Personenfelder tragen ab M6 den Bezeichner statt des `preferred_username`. Die dortige
Begründung – *es gibt kein Verzeichnis* – wird durch diesen Meilenstein gegenstandslos; die
Entscheidung war für M5.5 richtig und wird jetzt falsch.

## Begründung

**Zu 1 und 2 – warum der Bezeichner und nicht der Name.** Ein Name ist eine Anzeige, keine
Identität. `PROD-065` ist kein Sonderfall, sondern die notwendige Folge daraus, dass die
Plattform eine Anzeige als Schlüssel benutzt. Solange das so bleibt, ist jede Umbenennung ein
stiller Datenverlust und jede Wiedervergabe eine stille Zugriffsübertragung – **ohne
Fehlermeldung, ohne Auditeintrag, ohne abweichende Zeile.**

ADR-0031 hat den Bezeichner mit der Begründung verworfen, es gebe kein Verzeichnis, das ihn
auflösen könnte. Das war zutreffend und ist es ab M6 nicht mehr. Genau dafür führt ADR-0031
den Punkt als Folgeentscheidung.

**Zu 3 – warum Gruppen und nicht ein zweites Konstrukt.** Zuständigkeit je Bereich
(`PROD-017`) verlangt eine **Schachtelung** – ein Bereich mit Unterbereichen ist ein Baum.
Gruppen können das, Organizations nicht. Für den Mandanten wären Organizations passender, aber
zwei Konstrukte nebeneinander bedeuten zwei Verwaltungsoberflächen, zwei Mapper, zwei
Anspruchsformen und zwei Fehlerquellen – für einen Vorteil, den Punkt 5 ohnehin einholt.

**Zu 4 – warum keine Organizations, obwohl sie dafür gebaut sind.** Die Messung hat drei
Kosten sichtbar gemacht, die vorher niemand sehen konnte:

- **Die Anspruchsform ist nicht die erwartete.** Mit `addOrganizationId` wird aus der flachen
  Liste ein Objekt, **dessen Schlüssel weiterhin der Alias ist**; der Bezeichner steht im
  Wert. Wer die Schlüssel liest, hat wieder Namen – und `PROD-065` unverändert. Eine Falle,
  die man nur beim Ansehen der Form bemerkt
- **Der Passwort-Grant liefert den Anspruch überhaupt nicht.** Damit könnte
  `auth.keycloak.integration.spec.ts` – der einzige Test gegen echtes Keycloak – den
  Mandantenzuschnitt nicht prüfen. Eine Zusicherung, die nur die selbst signierten Token der
  übrigen Tests belegen, ist genau die Sorte Nachweis, die in diesem Projekt schon zweimal
  danebengelegen hat
- **Die Anmeldung ändert sich.** Mit eingeschalteten Organizations hat die Anmeldeseite kein
  Passwortfeld mehr: erst Benutzername, dann Passwort. Das trifft die Oberfläche und jede
  automatisierte Anmeldung

Keine dieser Kosten ist für sich entscheidend. Zusammen wiegen sie mehr als der Vorteil, den
Punkt 5 auch ohne Organizations liefert.

**Zu 5 – warum die Abbildung und nicht das Token.** Der Gruppen-Mapper kennt genau einen
inhaltlichen Schalter, `full.path`. Einen Bezeichner kann er nicht ausgeben. Daraus zu
schließen, Gruppen seien ungeeignet, wäre der Fehlschluss: **Die Stabilität muss nicht im
Token entstehen.** Die Admin-API führt Gruppen mit ihrer Kennung; der Identity & Access
Service hält daraus die Abbildung Pfad → Bezeichner aktuell. Eine Umbenennung ändert den Pfad
bei gleichbleibendem Bezeichner, und die Fachdaten merken davon nichts.

Das ist zugleich der Grund, aus dem Punkt 3 leichter wiegt, als er aussieht: Wenn die
Stabilität aus der Abbildung kommt, ist die Wahl des Keycloak-Konstrukts **keine tragende
Entscheidung mehr**. Sie ließe sich später wechseln, ohne die Fachdaten anzufassen.

**Zu 6 – warum das Attribut endet.** Ein Attribut hat kein Gegenstück. Es gibt nichts, was
eine Liste gültiger Werte führte, nichts, was eine Zugehörigkeit verwaltete, und nichts, was
eine Umbenennung nachzöge. `PROD-063` ist mit Attributen nicht lösbar, sondern nur
beschreibbar.

## Betrachtete Alternativen

### Beim Benutzerattribut bleiben

Der heutige Zustand. Nichts zu tun, keine Migration, kein neuer Mechanismus.

**Nicht gewählt.** `PROD-063` und `PROD-065` bleiben prinzipiell offen – nicht aus Nachlässigkeit,
sondern weil ein Attribut kein Gegenstück hat, gegen das geprüft werden könnte. §15 verlangt
Mandantenfähigkeit; eine Zeichenkette am Benutzer ist dafür keine Grundlage.

### Organizations für den Mandanten, Gruppen für Bereich und Vertretung

Die naheliegende Aufteilung, und vor der Messung die Empfehlung dieses Dokuments:
Organizations sind für Mandantenfähigkeit gebaut, bringen Domänen und einen eigenen Identity
Provider je Mandant mit, und nur sie können einen Bezeichner ausgeben.

**Nicht gewählt**, siehe Begründung zu 4. Der eigene Identity Provider je Mandant bleibt der
stärkste Punkt dafür – wenn ein Mandant den eigenen einbringen will, ist das der vorgesehene
Weg. Tritt dieser Fall ein, ist die Entscheidung neu zu treffen; Punkt 5 sorgt dafür, dass sie
dann die Fachdaten nicht berührt.

### Bezeichner ins Token, Namen im Dienst auflösen

Konsequent: Wenn die Fachdaten Bezeichner führen, könnte auch das Token sie führen.

**Nicht gewählt.** Der Gruppen-Mapper kann es nicht, und die Kosten wären beträchtlich: Eine
UUID misst 36 Byte, `t-eins` misst 6. Ein Anwender in zehn Mandanten kostete rund 360 statt 60
Byte – gegen ein Sitzungsbudget, das nach der letzten Messung bei 75 % steht und die Mandanten
noch gar nicht kennt (`PROD-045`). Punkt 5 erreicht dasselbe Ziel, ohne das Budget zu belasten.

### Zugehörigkeiten gar nicht im Token, sondern je Anfrage erfragen

Der Requirement Service fragt den Identity & Access Service nach den Zugehörigkeiten und reicht
sie OPA als `input`.

**Nicht gewählt.** Es koppelt jede Leseanfrage an die Verfügbarkeit eines zweiten Dienstes und
fügt dem Pfad, der ohnehin schon einen Sidecar-Aufruf trägt
([ADR-0028](0028-policy-engine-opa-als-sidecar.md)), einen weiteren hinzu. Das Token trägt die
Zugehörigkeit bereits; sie ein zweites Mal zu holen, kauft nichts, was Punkt 5 nicht billiger
liefert.

## Konsequenzen

### Positiv

- `PROD-063` und `PROD-065` werden **lösbar**, statt nur beschreibbar
- Ein Mechanismus für Mandant, Gruppe und Bereich statt drei
- Die Wahl des Keycloak-Konstrukts hört auf, eine tragende Entscheidung zu sein – sie lässt
  sich wechseln, ohne die Fachdaten anzufassen
- Zugehörigkeiten werden verwaltbar: Keycloak bringt für Gruppen eine Oberfläche mit,
  Attribute nicht

### Negativ und Risiken

- **Eine Migration des Bestands ist unvermeidlich.** `tenant`, `owner`, `responsible_group`
  und jedes Personenattribut tragen heute Namen. Die Umstellung muss die Historie einschließen
  – [ADR-0012](0012-vollstaendige-versionierung-mit-zeitbezug.md) verlangt, dass ein
  vergangener Zustand abfragbar bleibt, und ein zur Hälfte umgestellter Verlauf verletzt genau
  das
- **Die Abbildung ist ein neuer Ausfallpunkt.** Läuft sie der Realität hinterher, greift ein
  Zuschnitt ins Leere – und zwar leise, weil ein unbekannter Pfad wie „keine Zugehörigkeit"
  aussieht. Sie braucht eine eigene Prüfung und einen sichtbaren Fehlerfall, nicht nur einen
  Abgleichlauf
- **Die Oberfläche kann Namen nicht mehr einfach anzeigen.** Jede Liste, die heute `owner`
  ausgibt, braucht eine Auflösung – mit Zwischenspeicher, sonst wird aus einer Liste mit
  fünfzig Zeilen eine Anfrage mit fünfzig Auflösungen
- **`PROD-067` ändert seine Gestalt.** Der dort verlangte Mapper ist dann
  `oidc-group-membership-mapper` und nicht der Attribut-Mapper. Die Lücke bleibt dieselbe: Die
  Realm braucht Testbenutzer mit **unterschiedlicher** Zugehörigkeit, sonst beweist kein Test
  etwas
- **Ein eigener Identity Provider je Mandant ist damit nicht vorgesehen.** Tritt der Bedarf
  ein, ist Punkt 4 neu zu bewerten

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Ob die Abbildung Pfad → Bezeichner ereignisgetrieben oder im Abgleichlauf gepflegt wird | Mit der Umsetzung von Punkt 5 |
| Wie der Bestand migriert wird, ohne die Zusicherung aus ADR-0012 zu verletzen | Vor der Umstellung, als eigener Meilensteinschritt |
| Ob die Oberfläche Namen über einen eigenen Endpunkt auflöst oder sie an den Listen mitgeliefert bekommt | Mit der ersten Liste, die Bezeichner anzeigt |
| Ob Organizations doch gebraucht werden | Sobald ein Mandant einen eigenen Identity Provider einbringen soll |
| Ob `identitaet` auch gegen eine Gruppenzugehörigkeit prüfen darf | Unverändert offen aus [ADR-0031](0031-personenfelder-und-identitaetsvergleich.md) |

## Nachweise

Gemessen am 2026-08-21 gegen das laufende lokale Keycloak **26.7.1**. Die Probe hat
`organizationsEnabled` eingeschaltet, zwei Organisationen angelegt, `test.author` in beide
aufgenommen und den Zustand danach vollständig zurückgebaut.

**Verfügbarkeit.** `ORGANIZATION` meldet `enabled=true, type=DEFAULT` – unterstützt, kein
Vorschaumerkmal. Die Realm stand auf `organizationsEnabled=false`.

**Was die Mapper können**, aus `/admin/serverinfo`:

| Mapper | Inhaltliche Schalter |
|---|---|
| `oidc-group-membership-mapper` | **nur** `full.path` |
| `oidc-organization-membership-mapper` | `addOrganizationId`, `addOrganizationAttributes`, `addOrganizationDomain`, `multivalued` |

**Mehrfachmitgliedschaft ist möglich.** Beide Organisationen führten `test.author` als
Mitglied (`membershipType=UNMANAGED`), und beide erschienen im Anspruch.

**Die Anspruchsformen**, aus `generate-example-access-token`:

```json
"organization": ["probe-zwei","probe-eins"]

"org_mit_id": {"probe-zwei":{"id":"88649147-…"},
               "probe-eins":{"id":"92fef79f-…"}}
```

Mit `addOrganizationId` bleibt der Alias der **Schlüssel**; der Bezeichner steht im Wert.

**Der Passwort-Grant liefert den Anspruch nicht.** Über `test-cli` blieb er leer – auch mit
`scope=organization` und `scope=organization:*`, im Zugriffstoken, im ID-Token und in
`userinfo`. Sichtbar wurde er ausschließlich über die Mapper-Auswertung.

**Die Anmeldung wechselt auf Identity-First.** Bei eingeschalteten Organizations enthielt die
Anmeldeseite genau ein Eingabefeld:

```html
<input id="username" name="username" value="" type="text" autocomplete="username" autofocus/>
```

Kein Passwortfeld. Ein Formular mit Benutzername **und** Passwort beantwortete Keycloak mit
HTTP 400.
