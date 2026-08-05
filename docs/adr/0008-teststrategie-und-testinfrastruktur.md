# ADR-0008: Teststrategie und Testinfrastruktur

- **Status:** Angenommen
- **Datum:** 2026-08-04
- **Betrifft:** CLAUDE.md §2, §6, §8, §16
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§2 fordert Test-Driven Design – Tests entstehen vor beziehungsweise parallel zur
Implementierung – sowie automatisierte Tests und automatisierte Sicherheitsprüfungen.

Entscheidend ist, **was** geprüft wird. Die fachlich und technisch schwierigen Anteile
dieser Plattform liegen an drei Stellen:

- **Persistenz** – JSONB-Abfragen für das dynamische Attributmodell (§6), Migrationen,
  Historisierung (§16)
- **Autorisierung** – Rollen-, Objekt- und Feldebene (§8), einschließlich
  Service-Account-Zugriffen
- **Laufzeitvalidierung** gegen Attributdefinitionen, die zur Bauzeit unbekannt sind (§6)

Alle drei entziehen sich einer Prüfung gegen Attrappen: Ein nachgebildeter
Datenbankzugriff bestätigt die eigene Erwartung, nicht das Verhalten von PostgreSQL.

Aus [ADR-0001](0001-backend-sprache-und-framework.md) folgt NestJS, was
`experimentalDecorators` und `emitDecoratorMetadata` voraussetzt
([ADR-0006](0006-typescript-version-und-modulsemantik.md)). Das schränkt die Wahl des
Testwerkzeugs ein.

## Entscheidung

**1. Vitest** ist der Testrunner für alle TypeScript-Anteile.

**2. Die Transformation erfolgt über SWC** (`unplugin-swc` mit `@swc/core`), nicht über
den Vitest-Standard esbuild.

**3. Drei Teststufen mit klarer Zuständigkeit:**

| Stufe | Prüft | Infrastruktur |
|---|---|---|
| Unit | Reine Logik ohne Framework – Berechnungen, Regelauswertung, Schema-Erzeugung | keine |
| Integration | Alles, was die Anwendung mit ihrer Umgebung tut – Persistenz, Migrationen, HTTP-Schicht, Guards | echte Container |
| System | Zusammenspiel der vollständigen lokalen Umgebung | Compose-Stapel |

**4. PostgreSQL wird für Integrationstests über Testcontainers bereitgestellt**, je
Testlauf frisch, mit angewandten Migrationen. Keine Attrappen für Datenbankzugriffe, kein
In-Memory-Ersatz, kein SQLite.

**5. Keycloak wird nicht über Testcontainers gestartet.** Stattdessen zweigeteilt:

- **Schnelle Tests** der Guard-Logik gegen ein im Testprozess erzeugtes Schlüsselpaar mit
  eigenem JWKS-Endpunkt. Damit sind Signaturprüfung, `iss`, `aud`, `exp` und
  Rollenauswertung deterministisch und ohne Wartezeit prüfbar – einschließlich der
  Fehlerfälle, die sich mit echtem Keycloak nur umständlich erzeugen lassen (abgelaufenes
  Token, falsche Zielgruppe, fremder Aussteller).
- **Ein Integrationstest je Service** gegen die echte, per Compose bereitgestellte
  Keycloak-Instanz. Er beweist, dass Realm-Konfiguration und Guard tatsächlich
  zusammenpassen.

**6. Ein neuer Endpunkt beginnt mit einem fehlschlagenden Integrationstest**, nicht mit
einem Unit-Test und nicht mit der Implementierung.

## Begründung

**Zu 2 – der wichtigste technische Punkt.** Der eingebaute Transformator von Vitest
unterstützt `emitDecoratorMetadata` **nicht**. Die Typinformationen, die NestJS zur
Auflösung seiner Abhängigkeiten benötigt, fehlen damit zur Testlaufzeit. Das äußert sich
als `Cannot resolve dependency at index [0]` – ein Fehler, der auf ein
Verdrahtungsproblem hindeutet, obwohl die Ursache im Transformator liegt. SWC unterstützt
die Metadatenerzeugung und ist gleichzeitig schnell genug, um den
Geschwindigkeitsvorteil von Vitest zu erhalten.

> **Nachtrag 2026-08-04 – Abschaltung des eingebauten Transformators.**
> Die ursprüngliche Fassung nannte esbuild als eingebauten Transformator. **Ab Vitest 4
> ist es Oxc.** Praktische Folge: `unplugin-swc` schaltet über `esbuild: false` ab, was
> wirkungslos geworden ist – der eingebaute Transformator läuft weiter mit. Vitest weist
> darauf hin:
>
> ```
> `esbuild` option is set to false, but `oxc` option was not set to false.
> ```
>
> Die Entscheidung für SWC bleibt unverändert. Erforderlich ist zusätzlich `oxc: false`
> auf oberster Ebene der Vitest-Konfiguration.
>
> **Prüfbarkeit:** Ein Test ohne Dependency Injection deckt einen kaputten
> Metadaten-Pfad *nicht* auf. Deshalb enthält der erste Endpunkt jedes Service
> verbindlich mindestens eine über den Konstruktor injizierte Abhängigkeit – sonst
> verschiebt sich der Fehler auf einen späteren Meilenstein, weit weg von seiner Ursache.
>
> **Konfigurationsdatei:** Wegen `"type": "commonjs"`
> ([ADR-0006](0006-typescript-version-und-modulsemantik.md)) heißt die Datei
> `vitest.config.mts`, nicht `.ts` – die Endung erzwingt ESM unabhängig vom `type`-Feld
> des Pakets.

**Zu 4.** Das dynamische Attributmodell steht und fällt mit JSONB-Verhalten, das kein
Ersatzsystem nachbildet: GIN-Indizes, JSON-Path-Abfragen, Typkoerzierung, Sortierung von
Schlüsseln. Ein Test gegen SQLite oder eine Attrappe würde grün sein und in der Produktion
scheitern. Der Startaufwand eines PostgreSQL-Containers liegt im Sekundenbereich und ist
damit vertretbar.

**Zu 5 – warum hier bewusst anders.** Keycloak braucht 30 bis 60 Sekunden bis zur
Bereitschaft, und seine Konfiguration ist für alle Tests identisch. Der Nutzen eines
eigenen Containers je Testlauf ist entsprechend gering, die Kosten hoch. Die Prüfung
eines JWT ist zudem reine Kryptografie mit klar umrissenen Regeln – dafür ist ein
selbst erzeugtes Schlüsselpaar nicht weniger aussagekräftig als ein von Keycloak
ausgestelltes, wohl aber deutlich besser steuerbar.

Der eine echte Integrationstest schließt die verbleibende Lücke: Er stellt sicher, dass
die Annahmen über Ausstellerbezeichnung, Zielgruppen-Anspruch und Rollenstruktur mit der
tatsächlichen Realm-Konfiguration übereinstimmen. Genau diese Annahmen driften – die
Kryptografie tut es nicht.

## Betrachtete Alternativen

### Jest mit ts-jest

Unterstützt `emitDecoratorMetadata` ohne Zusatzkonfiguration und ist im
NestJS-Ökosystem die Voreinstellung.

Nicht gewählt, weil `ts-jest` den vollständigen TypeScript-Compiler je Testdatei
ausführt und damit deutlich langsamer ist. Bei Test-Driven Design ist die Länge der
Rückmeldeschleife kein Komfortmerkmal, sondern bestimmt, ob der Ansatz durchgehalten
wird.

### Keycloak ebenfalls über Testcontainers

Fachlich am saubersten und konsequent zu Punkt 4.

Nicht gewählt wegen der Startzeit. Wird die Testsuite dadurch auf Minuten verlängert,
werden Tests seltener ausgeführt – was mehr kostet, als der Zugewinn an Aussagekraft
einbringt. Zu überprüfen, falls sich die Zweiteilung als fehleranfällig erweist.

### Ausschließlich Unit-Tests gegen Attrappen

Schnell und ohne Infrastrukturbedarf.

Nicht gewählt: Attrappen prüfen die eigene Erwartung an ein fremdes System. Genau dort,
wo diese Plattform schwierig ist, ist die Erwartung das Unsichere.

## Konsequenzen

### Positiv

- Tests prüfen tatsächliches Verhalten von PostgreSQL, nicht angenommenes.
- Fehlerfälle der Token-Prüfung sind vollständig und schnell abdeckbar.
- Die Rückmeldeschleife bleibt kurz genug für Test-Driven Design.

### Negativ und Risiken

- **Docker ist Voraussetzung, um Tests auszuführen** – auch lokal. Das erhöht die
  Einstiegshürde und macht die Testsuite von der Container-Laufzeit abhängig.
- **Die Zweiteilung bei Keycloak kann auseinanderlaufen.** Der in-process ausgestellte
  Token muss dieselben Prüfungen durchlaufen wie ein echter. Weicht die Guard-Konfiguration
  zwischen beiden Pfaden ab, prüfen die schnellen Tests etwas anderes als die Produktion.
  Gegenmaßnahme: Der Guard wird in beiden Fällen identisch konfiguriert; unterschiedlich
  ist ausschließlich die Herkunft des JWKS.
- **Container-Startzeiten dominieren die Testlaufzeit.** Gegenmaßnahme: Wiederverwendung
  von Testcontainers-Instanzen innerhalb eines Laufs, nicht je Testdatei.
- **SWC ist ein zweiter Transformator neben `tsc`.** Er prüft keine Typen. Der Typecheck
  bleibt ein eigener Schritt und darf nicht durch grüne Tests als erledigt gelten.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Abdeckungsschwelle und ob sie den Build bricht | M1, nach den ersten Tests |
| Testdatenaufbau: Fixtures, Fabriken oder Migrationsstände | M1 |
| Vertragstests zwischen Services | Sobald der zweite Service existiert |
| Lasttests gegen die Prognoseberechnung | M7 |
