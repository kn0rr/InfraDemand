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
