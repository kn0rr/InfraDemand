# Requirement Service

Fachlicher Kern der Plattform: Anforderungen, Projekte, Status und Lebenszyklus,
Kommentare, Anhänge und Historisierung. Ab Meilenstein M3 zusätzlich die Verwaltung der
Attributdefinitionen (CLAUDE.md §6), ab M4 die Workflow-Definitionen (§7).

Die vollständige fachliche Abgrenzung steht in
[docs/architecture/services.md](../../docs/architecture/services.md#requirement-service).

**Stand:** Meilenstein M1.1 – Service-Gerüst und Test-Harness. Es existiert noch kein
Anwendungscode; der erste Test ist bewusst rot.

---

## Voraussetzungen

Die allgemeine Entwicklungsumgebung muss eingerichtet sein – Node.js, pnpm und Docker
Desktop. Siehe
[docs/development/installation.md](../../docs/development/installation.md).

Die lokale Infrastruktur muss laufen, sobald der Service auf PostgreSQL oder Keycloak
zugreift (ab M1.2):

```powershell
pnpm run infra:up
```

---

## Einrichtung

Aus dem Repository-Wurzelverzeichnis:

```powershell
pnpm install
```

Ein eigener Installationsschritt für den Service ist nicht nötig – pnpm richtet den
gesamten Arbeitsbereich in einem Durchgang ein
([ADR-0002](../../docs/adr/0002-repository-struktur.md)).

---

## Befehle

Alle Befehle aus dem Repository-Wurzelverzeichnis, mit `--filter` auf dieses Paket:

| Befehl | Wirkung |
|---|---|
| `pnpm --filter @infrademand/requirement test` | Tests einmalig ausführen |
| `pnpm --filter @infrademand/requirement test:watch` | Tests im Beobachtungsmodus |
| `pnpm --filter @infrademand/requirement typecheck` | Typprüfung ohne Ausgabe |
| `pnpm --filter @infrademand/requirement build` | Übersetzen nach `dist/` |
| `pnpm --filter @infrademand/requirement dev` | Entwicklungsserver mit Neustart bei Änderungen |

Aus dem Wurzelverzeichnis über alle Pakete hinweg: `pnpm test`, `pnpm typecheck`.

---

## Projektstruktur

```
services/requirement/
├─ src/                     Anwendungscode
│  ├─ main.ts               Einstiegspunkt, Fastify-Adapter
│  ├─ app.module.ts         Wurzelmodul
│  └─ health/               Health-Endpunkt
├─ test/                    Integrationstests
│  └─ health.spec.ts
├─ .swcrc                   SWC-Transformation (Decorator-Metadaten)
├─ nest-cli.json            NestJS-CLI, verweist auf tsconfig.build.json
├─ package.json
├─ tsconfig.json            Typprüfung: src + test
├─ tsconfig.build.json      Übersetzung: nur src, ohne Tests
└─ vitest.config.mts        Endung .mts, nicht .ts – siehe unten
```

### Warum `vitest.config.mts` und nicht `.ts`

Das Paket ist CommonJS (`"type": "commonjs"`), die Konfigurationsdatei nutzt
ESM-Syntax. Die Endung `.mts` erzwingt ESM unabhängig vom `type`-Feld. Mit `.ts` warnt
Vite, dass die Datei künftig nicht mehr geladen werden kann. `"type": "module"` zu setzen
wäre der falsche Ausweg – das bräche NestJS.

### Warum zwei tsconfig-Dateien

`tsconfig.json` umfasst `src/` **und** `test/` – der Editor und `typecheck` sollen
Testcode mitprüfen. `tsconfig.build.json` schließt Tests aus, damit sie nicht im
Container-Image landen. `nest-cli.json` verweist ausdrücklich auf die zweite Datei.

Beide erben über `../../tsconfig.node.json` von `tsconfig.base.json`
([ADR-0006](../../docs/adr/0006-typescript-version-und-modulsemantik.md)).

---

## Werkzeugkette

| Paket | Version | Zweck |
|---|---|---|
| `@nestjs/core`, `@nestjs/common` | 11.1.x | Anwendungsframework |
| `@nestjs/platform-fastify` | 11.1.x | HTTP-Adapter – Fastify, nicht Express |
| `@nestjs/config` | 4.0.x | Konfiguration aus der Umgebung |
| `vitest` | 4.1.x | Testrunner |
| `unplugin-swc`, `@swc/core` | 1.5.x / 1.15.x | Transformation der Tests |
| `supertest` | 7.2.x | HTTP-Aufrufe gegen die laufende Anwendung im Test |

Begründung der Auswahl:
[ADR-0001](../../docs/adr/0001-backend-sprache-und-framework.md) (NestJS, Fastify) und
[ADR-0008](../../docs/adr/0008-teststrategie-und-testinfrastruktur.md) (Vitest, SWC).

---

## Konfiguration

Gelesen über `@nestjs/config` aus der Prozessumgebung.

| Variable | Vorgabewert | Ab | Zweck |
|---|---|---|---|
| `PORT` | `3001` | M1.1 | HTTP-Port |
| `KEYCLOAK_ISSUER_URL` | – | M1.2 | Erwarteter Aussteller, Grundlage der JWKS-Abfrage |
| `KEYCLOAK_AUDIENCE` | – | M1.2 | Erwarteter Zielgruppen-Anspruch (`requirement-api`) |
| `DATABASE_URL` | – | M1.3 | Verbindung zur **eigenen** Datenbank (`requirement`), nicht zu einer fremden |

Lokale Werte stehen in [docs/development/installation.md](../../docs/development/installation.md#10-lokale-zugänge).
Für nicht-lokale Umgebungen gilt CLAUDE.md §13 – Werte aus HashiCorp Vault, siehe
`PROD-010`.

---

## Endpunkte

| Pfad | Auth | Zweck |
|---|---|---|
| `GET /health` | nein | Bereitschaftsprüfung für die Orchestrierungsschicht |
| `GET /v1/requirements` | **ja** | Liste der Anforderungen; liefert bis M1.3 eine leere Liste |

`/health` ist bewusst **unversioniert und unauthentifiziert**. Alle fachlichen Endpunkte
liegen unter `/v1/` und erfordern ein gültiges Token
([ADR-0004](../../docs/adr/0004-authentifizierung-und-autorisierung.md)).

### Wie der Schutz greift

Der JWT-Guard ist **global** registriert (`APP_GUARD` in `src/auth/auth.module.ts`).
Damit ist jeder Endpunkt geschützt, ohne dass jemand daran denken muss. Ausnahmen werden
ausdrücklich mit `@Public()` gekennzeichnet.

Die Richtung ist entscheidend: Ein vergessener `@UseGuards()` erzeugt keinen Fehler,
sondern eine offene API – und Abwesenheit fällt im Review nicht auf. Ein vergessenes
`@Public()` erzeugt dagegen ein 401, das sofort auffällt.

**Die schnellste Sicherheitsprüfung dieses Service:**

```bash
grep -rn "@Public()" src/
```

Jeder Treffer außerhalb von `src/health/` gehört hinterfragt.

### Geprüfte Ablehnungsgründe

`test/auth.spec.ts` deckt alle Fälle gegen ein im Testprozess erzeugtes Schlüsselpaar ab:
kein Token, unlesbares Token, fremder Aussteller, falsche Zielgruppe, abgelaufen, fremder
Signaturschlüssel. `test/auth.keycloak.integration.spec.ts` prüft zusätzlich ein echtes
Keycloak-Token – siehe [ADR-0008](../../docs/adr/0008-teststrategie-und-testinfrastruktur.md).

Die Einschränkung `algorithms: ["RS256"]` in der Strategie ist nicht optional: Ohne sie
akzeptiert die Prüfung den im Token angegebenen Algorithmus, was die Signaturprüfung
aushebelt.

**Noch keine Rollenprüfung.** Ein gültiges Token genügt derzeit. Die Autorisierung auf
Objekt- und Feldebene folgt mit dem Berechtigungsmodell in M5.

Der OpenAPI-Contract entsteht in M1.4 unter `docs/api/requirement.openapi.yaml`
([ADR-0005](../../docs/adr/0005-api-first-workflow.md)).

---

## Datenhaltung

Drizzle ORM mit `drizzle-kit` für Migrationen
([ADR-0009](../../docs/adr/0009-orm-und-migrationswerkzeug.md)). Der Service verbindet
sich ausschließlich mit der Datenbank `requirement` und der gleichnamigen Rolle
([ADR-0003](../../docs/adr/0003-datenbank-und-datenhoheit.md)).

```
src/database/
├─ schema.ts            Tabellendefinitionen; einzige Quelle fuer Schema und Typen
├─ database.tokens.ts   Injektionsmarken und der Typ Database
└─ database.module.ts   Verbindungspool, global bereitgestellt
drizzle/                erzeugte Migrationen - werden gelesen, nicht nur uebernommen
```

### Schema ändern

```powershell
pnpm --filter @infrademand/requirement db:generate
```

**Die erzeugte Datei unter `drizzle/` anschließend lesen.** `drizzle-kit` leitet aus dem
Schema-Unterschied ab und erzeugt bei Umbenennungen unter Umständen `DROP` und `ADD`
statt `RENAME` – mit Datenverlust. Diese Prüfung ist Regel 1 aus ADR-0009 und nicht
optional.

Anwenden gegen die lokale Datenbank:

```powershell
pnpm --filter @infrademand/requirement db:migrate
```

In den schnellen Tests werden die Migrationen automatisch gegen den Testcontainer
angewandt.

### Integrationstests

Sie laufen gegen die **echte** lokale Infrastruktur – Keycloak und die Datenbank
`requirement`:

```powershell
pnpm run infra:up
pnpm --filter @infrademand/requirement db:migrate
pnpm --filter @infrademand/requirement test:integration
```

Der Umweg über die echte Datenbank statt über einen Testcontainer ist Absicht: Er weist
nach, dass die erzeugten Migrationen **mit den Rechten der Servicerolle** durchlaufen. Der
Testcontainer läuft mit weitreichenden Rechten; die Rolle `requirement` ist lediglich
Eigentümerin ihrer Datenbank. Eine Migration, die mehr voraussetzt, wäre im Container grün
und in der Zieldatenbank rot – und das fiele sonst erst beim Ausrollen auf.

### Versionshistorie

`requirement_history` enthält **jede** Version eines Datensatzes, einschließlich der
aktuellen ([ADR-0012](../../docs/adr/0012-vollstaendige-versionierung-mit-zeitbezug.md)).
Die Fachtabelle `requirement` führt daneben ausschließlich den aktuellen Zustand als
schnellen Zugriffsweg.

Eine Stichtagsabfrage ist dadurch eine Abfrage gegen **eine** Tabelle:

```sql
WHERE valid_from <= :zeitpunkt AND (valid_to > :zeitpunkt OR valid_to IS NULL)
```

Die Historie ist zugleich der Auditpfad nach §16 – alter Wert, neuer Wert und feldgenaue
Herkunft ergeben sich aus dem Vergleich aufeinanderfolgender Versionen.

#### Zwei bewusste Auslassungen im Schema

**Kein Fremdschlüssel von `requirement_history.id` auf `requirement.id`.** Das ist kein
Versäumnis. Ein gelöschter Datensatz verlässt die Fachtabelle, seine Historie muss bleiben
– ein Fremdschlüssel würde die Löschung entweder verhindern oder per Kaskade den Nachweis
vernichten. **Nicht nachträglich ergänzen.**

**Kein GIN-Index auf `requirement_history.dynamic_attributes`.** Stichtagsabfragen mit
Filter auf dynamische Attribute wären damit schneller. Die Historientabelle wird jedoch
die größte des Service, und der Index kostet bei jedem Schreibvorgang. Vertagt, bis ein
konkreter Auswertungsbedarf ihn rechtfertigt.

#### Die Herkunftsregistratur (`source_system`)

Seit M3.1 führt der Service eine Registratur der Herkunftssysteme mit dem Merkmal
*automatisch* oder *manuell*
([ADR-0017](../../docs/adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A4).
Ohne sie lässt sich zu einer Schreiboperation die Quellenklasse nicht bestimmen, und ab
M3.4 greift ohne sie keine Hoheitsregel.

**`requirement.source_system` trägt einen Fremdschlüssel darauf, `requirement_history`
nicht.** Dieselbe Begründung wie oben: Die Historie darf nie durch den aktuellen Zustand
eingeschränkt werden. Wird eine Quelle außer Betrieb genommen, muss die Historie der
Datensätze, die aus ihr stammen, unverändert lesbar bleiben.

**Der Fremdschlüssel ist nicht die Prüfung.** Abgewiesen wird in
`SourceSystemsService.pruefeSchreibquelle` mit einer verwertbaren Meldung (400); der
Fremdschlüssel ist die Zusicherung, dass kein späterer Schreibpfad daran vorbeikommt –
dieselbe Arbeitsteilung wie bei der Eindeutigkeit aus §19.1.

**Für Tests:** Wer eine fremde Herkunft verwendet, muss sie zuvor eintragen –
`registriereQuelle` aus `test/support/source-systems.ts`. Nur `infrademand` kommt aus der
Migration.

#### Attributdefinitionen und ihre Prüfung

`attribute_definition` führt die dynamischen Attribute aus §6 als versionierte Fachdaten.
Die Geltung je Anforderungstyp steht in `requirement_type`; **`NULL` bedeutet: für alle**.
Die Eindeutigkeit trägt deshalb `NULLS NOT DISTINCT` – ohne sie wären zwei
allgemeingültige Definitionen desselben Schlüssels möglich, weil PostgreSQL `NULL`-Werte
sonst als verschieden behandelt.

**Geprüft wird gegen die aktuell gültige Definition**, nicht gegen die bei Anlage des
Datensatzes geltende. §6 legt das so fest. Das ist der Unterschied zu §7, wo laufende
Anforderungen auf ihrer Workflow-Fassung bleiben; die Historie hier dient der
Nachweisführung, nicht der Festlegung.

**`pruefeDynamischeAttribute` ist der einzige Prüfpfad** und bewusst frei von NestJS und
Datenbank. §19.2 verlangt, dass Schnittstelle, Dateiimport und manuelle Erfassung dieselbe
Validierung durchlaufen – eine reine Funktion lässt sich von jedem Eingangsweg aufrufen
und mit gewöhnlichen Unittests abdecken.

**Was gespeichert wird, ist nicht, was gesendet wurde.** Die Prüfung liefert normalisierte
Werte zurück: Vorgabewerte ergänzt, leere optionale Attribute entfernt, nicht definierte
Schlüssel abgewiesen. In `dynamic_attributes` steht damit nie ein Schlüssel, den keine
Definition erklärt.

**Zur Datumsprüfung:** Der Rückvergleich in `istKalenderdatum` ist nicht überflüssig.
JavaScript liefert für `2026-02-31` kein `NaN`, sondern stillschweigend den 3. März – nur
der Monatsüberlauf erzeugt `NaN`. Ohne den Vergleich gingen ungültige Tagesangaben durch
und läsen sich später als ein anderes Datum.

**Für Tests:** `registriereAttribut` aus `test/support/attribute-definitions.ts`. Ohne
Definition wird jedes dynamische Attribut abgewiesen.

#### Hoheitsregeln (`mastership_rule`)

Welche Quellenklasse für ein Feld den Vorrang hat (§19.3,
[ADR-0017](../../docs/adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md)).

**Die Spalte heißt `field`, nicht `attributeKey`.** Der Schlüsselraum umfasst Kernfelder
wie `owner` **und** Schlüssel dynamischer Attribute – ADR-0017 spricht von Datenhoheit „je
Feld", und sein eigenes Beispiel ist ein Kernfeld. Deshalb auch kein Fremdschlüssel auf
`attribute_definition`; Kernfelder stehen dort nicht.

**Kein `active`.** Bei Attributdefinitionen ist das Außerkraftsetzen nötig, weil eine
gelöschte Definition Werte unlesbar machen würde. Hier ist der Vorgabewert
`manual_allowed` selbst der Zustand „keine Einschränkung" – eine Regel abzuschalten und sie
auf den Vorgabewert zu setzen wäre dasselbe.

**Die Eindeutigkeit liegt auf `(field, bindings)`.** ADR-0017 A6 verspricht, dass ein
späterer Geltungsbereich ein Datensatz und keine Migration ist. Läge sie nur auf `field`,
bräuchte die zweite Regel für dasselbe Feld genau die Schemaänderung, die A6 ausschließt.
PostgreSQL normalisiert dabei die Schlüsselreihenfolge in `jsonb`: `{"a":1,"b":2}` und
`{"b":2,"a":1}` sind derselbe Geltungsbereich – genau das ist gewollt.

#### Warum der versionierte Schreibpfad nicht extrahiert ist

Drei Entitäten schreiben inzwischen Versionen, und der Ablauf ist jedes Mal derselbe. Er
ist **trotzdem ausgeschrieben**, nicht in eine generische Hilfsfunktion gezogen.

Der mechanische Teil scheitert laut, wenn man ihn falsch abschreibt. Riskant ist die
zeitliche Zusicherung: derselbe Zeitstempel auf beiden Seiten, die Vorgängerversion mit
genau diesem Wert geschlossen, genau eine offene Version. Wird das falsch, **korrumpiert
die Historie stillschweigend** – Stichtagsabfragen liefern einfach andere Ergebnisse.

Eine generische Funktion über Drizzle-Tabellen bräuchte schwere Generik oder
Typausnahmen – und würde genau die Eigenschaft wieder einführen, wegen der
[ADR-0009](../../docs/adr/0009-orm-und-migrationswerkzeug.md) MikroORM verworfen hat: einen
Mechanismus, dessen Versagen an der Aufrufstelle nicht sichtbar ist.

Stattdessen prüft `test/support/versionierung.ts` die Zusicherung für **jede**
Historientabelle: lückenlos, überschneidungsfrei, fortlaufende Versionen, genau eine offene,
und die Fachtabelle trägt die höchste Versionsnummer. **Eine neue versionierte Entität wird
nur in die Liste in `test/versionierung.integration.spec.ts` aufgenommen.**

### Schichtung

```
Controller  →  Service  →  Repository  →  Drizzle
```

**Datenbankzeilen verlassen das Repository nicht.** Die Zuordnung auf den API-Typ
(`RequirementResponse`) erfolgt in der Service-Schicht. Der Test
*„gibt keine Datenbankspalten preis"* prüft die Antwortschlüssel abschließend – fügst du
später eine interne Spalte hinzu und reichst die Zeile versehentlich durch, wird er rot,
bevor das Feld Vertragsbestandteil einer öffentlichen API wird (§12).

## Bekannte Stolpersteine

### Sporadisches `No test suite found` in den Integrationstests

Trat mit dem vierten Integrationstest auf: Ein Testfile meldete null Suiten, einzeln
ausgeführt lief dasselbe File grün.

Ursache war keine Datei, sondern eine Einstellung, die sich selbst widersprach.
`vitest.base.mts` setzt `hookTimeout: 90_000` mit der Begründung, Container-Starts
brauchten Luft. Die Integrationskonfiguration senkte ihn auf `30_000` – **ausgerechnet
dort, wo die Container tatsächlich starten.** Mit vier gleichzeitig hochfahrenden
PostgreSQL-Containern wurde die Grenze erreicht.

Behoben, indem `vitest.integration.config.mts` beide Zeitgrenzen nicht mehr überschreibt.
Sie setzt nur noch Einrichtungsdatei und Dateimuster. Sollte es erneut auftreten, ist der
nächste Griff `fileParallelism: false` – vier Container nacheinander statt gleichzeitig.

**Merksatz:** Eine abgeleitete Konfiguration, die einen Wert der Basis verengt, braucht
denselben begründenden Kommentar wie die Basis. Ohne ihn kippt die Absicht bei der ersten
Änderung.

### `Cannot resolve dependency at index [0]` im Test

Fast immer die Transformation, nicht die Moduldefinition. Prüfen:

1. Liegt `.swcrc` im **Paketwurzelverzeichnis** – also `services/requirement/.swcrc`,
   nicht eine Ebene höher?
2. Steht darin `"decoratorMetadata": true`?
3. Steht `oxc: false` in `vitest.config.mts`?

Zu Punkt 3: Der eingebaute Transformator von Vitest 4 ist Oxc, und er unterstützt
`emitDecoratorMetadata` nicht. `unplugin-swc` schaltet ihn über `esbuild: false` ab – was
seit Vitest 4 wirkungslos ist. Ohne ausdrückliches `oxc: false` transformiert Oxc weiter
mit, und NestJS fehlen die Typinformationen zur Auflösung seiner Abhängigkeiten.

### Verbindungsfehler von supertest, obwohl die Anwendung startet

Bei Fastify genügt `await app.init()` nicht. Zusätzlich erforderlich:

```
await app.getHttpAdapter().getInstance().ready();
```

Ohne diesen Aufruf nimmt der Server noch keine Verbindungen an.

### `Cannot find module '../src/...'` mit `Require stack:` im Test

Die Datei existiert, wird aber nicht gefunden. Ursache ist der Modultyp der
SWC-Ausgabe: Bei `commonjs` entstehen echte `require()`-Aufrufe, die Vitests
Modul-Runner nach Node-CommonJS-Regeln auflöst – und die kennen keine `.ts`-Endung.

**Behebung:** In `vitest.config.mts` den Modultyp gezielt überschreiben:

```ts
plugins: [swc.vite({ module: { type: "es6" } })]
```

Der Hinweis `Require stack:` in der Fehlermeldung ist das Erkennungsmerkmal – bei einem
ESM-Import stünde dort etwas anderes.

**`.swcrc` bleibt dabei auf `commonjs`.** Die Werte gelten unterschiedlichen Zielen:

| Verwender | Modultyp | Grund |
|---|---|---|
| Vitest über `unplugin-swc` | `es6` | Vite löst Importe selbst auf und braucht ESM |
| Build mit `nest build --builder swc` | `commonjs` | Laufzeit ist CommonJS |

`.swcrc` auf `es6` zu setzen würde den Testlauf reparieren und einen künftigen SWC-Build
stillschweigend brechen – der Fehler träte dann erst im Container auf.

### `Cannot use import statement outside a module` zur Laufzeit

`"type": "commonjs"` fehlt in `package.json`. Unter `module: nodenext` bestimmt dieses
Feld das Ausgabeformat; ohne Angabe greift ein Vorgabewert, und der Fehler tritt erst nach
dem Übersetzen auf.
