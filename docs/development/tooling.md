# Werkzeugkette

Übersicht aller im Projekt eingesetzten Werkzeuge, ihrer Konfigurationsorte und der
Gründe für ihre Auswahl.

**Geltungsstand:** 2026-07-31, Meilenstein M0.

Wird ein Werkzeug hinzugefügt oder eine Version angehoben, wird dieses Dokument im selben
Commit aktualisiert.

---

## 1. Im Einsatz

| Werkzeug | Version | Konfiguration | Zweck |
|---|---|---|---|
| Node.js | 24.x LTS | `.node-version`, `engines` in `package.json` | Laufzeitumgebung |
| pnpm | 11.20.0 | `pnpm-workspace.yaml`, `packageManager` in `package.json` | Paket- und Arbeitsbereichsverwaltung |
| TypeScript | 5.9.3 exakt | `tsconfig.base.json`, `tsconfig.node.json` | Übersetzung und Typprüfung |
| Biome | 2.5.6 | `biome.json` | Linting und Formatierung |
| Docker Compose | – | `infra/local/compose.yaml` | Lokale Infrastruktur |
| PostgreSQL | 18 (Alpine) | `infra/local/compose.yaml`, `infra/local/postgres/init/` | Datenhaltung |
| Keycloak | 26.7.1 | `infra/local/compose.yaml`, `infra/keycloak/realms/` | Identitätsverwaltung |
| keycloak-config-cli | 6.5.1-26 | `infra/local/compose.yaml` (Profil `config`) | Idempotente Anwendung der Realm-Definition |
| EditorConfig | – | `.editorconfig` | Editorübergreifende Grundeinstellungen |
| Git-Attribute | – | `.gitattributes` | Erzwingt LF-Zeilenenden in Repository **und** Arbeitsverzeichnis |
| GitHub Actions | – | `.github/workflows/ci.yml` | CI: Lint, Realm-Validierung, Sicherheitsprüfung |
| Trivy | `latest` | `.github/workflows/ci.yml` | Abhängigkeits-, Geheimnis- und Image-Prüfung |
| actionlint | 1.7.12 | `.github/workflows/ci.yml`, Job `lint` | Prüft Workflow-Dateien auf Struktur- und Shell-Fehler |
| Renovate | – | `renovate.json` | Automatisierte Abhängigkeitsaktualisierung |

### Werkzeuge je Service

Gilt für jedes Paket unter `services/*`, Referenzumsetzung ist
[`services/requirement`](../../services/requirement/README.md).

| Paket | Version | Konfiguration | Zweck |
|---|---|---|---|
| NestJS | 11.1.x | `nest-cli.json` | Anwendungsframework |
| `@nestjs/platform-fastify` | 11.1.x | – | HTTP-Adapter (Fastify, nicht Express) |
| `@nestjs/config` | 4.0.x | – | Konfiguration aus der Prozessumgebung |
| `@nestjs/swagger` | 11.4.x | `src/openapi.ts` | Erzeugung des Contracts aus dem Code ([ADR-0005](../adr/0005-api-first-workflow.md)) |
| `@fastify/static` | 10.1.x | – | Auslieferung der Swagger-Oberfläche unter Fastify (`PROD-048`) |
| Vitest | 4.1.x | `vitest.config.ts` | Testrunner |
| SWC | 1.15.x | `.swcrc` | Transformation der Tests inkl. Decorator-Metadaten |
| supertest | 7.2.x | – | HTTP-Aufrufe gegen die laufende Anwendung im Test |

**SWC ist nicht optional.** Der Standardtransformator von Vitest ist esbuild, und esbuild
unterstützt `emitDecoratorMetadata` nicht. Ohne SWC fehlen NestJS die Typinformationen zur
Auflösung seiner Abhängigkeiten; der Fehler erscheint als `Cannot resolve dependency at
index [0]` und weist damit auf die falsche Stelle. Siehe
[ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md).

### Werkzeuge des Frontends

| Paket | Version | Konfiguration | Zweck |
|---|---|---|---|
| Next.js | 16.3.x | `frontend/next.config.ts` | Anwendungsframework, App Router mit Turbopack |
| React | 19.2.x | – | Oberflächenbibliothek |
| `openid-client` | 6.8.x | `frontend/src/lib/auth/` | OIDC-Client für den Anmeldefluss ([ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md)) |
| `iron-session` | 8.0.x | `frontend/src/lib/auth/sitzung.ts` | Verschlüsseltes Sitzungscookie |
| `jose` | 6.2.x | – | Lesen der Rollen aus dem Zugriffstoken |
| `@mantine/core`, `@mantine/hooks` | 9.5.x | `src/app/anbieter.tsx` | Komponentengrundlage ([ADR-0016](../adr/0016-ui-grundlage-und-datenzugriff-im-frontend.md)) |
| `@mantine/form` | 9.5.x | – | Formularzustand, auch für dynamische Feldmengen (§6) |
| `@tanstack/react-query` | 5.101.x | `src/app/anbieter.tsx` | Serverzustand im Browser: Zwischenspeicher, Neuvalidierung, Lade- und Fehlerzustände |
| `openapi-typescript` | 7.13.x | `api:types` in `package.json` | Erzeugt `src/lib/api/schema.d.ts` aus dem eingecheckten Contract |
| `openapi-fetch` | 0.17.x | `src/lib/api/client.ts` | Typsicherer Aufruf entlang des Contracts |
| Vitest | 4.1.x | `vitest.base.mts`, `vitest.config.mts`, `vitest.integration.config.mts` | Testrunner, ohne SWC – im Frontend gibt es keine Decorators |

**Kein PostCSS.** Mantine liefert sein CSS übersetzt mit. `postcss-preset-mantine` wird
erst gebraucht, wenn eigenes CSS Mantines Mixins verwendet – bis dahin wäre es eine
Werkzeugkette ohne Gegenwert.

**Der Abfrage-Client wird nie auf Modulebene erzeugt.** Ein Modul wird im Node-Prozess
einmal ausgewertet und von allen Anfragen geteilt; ein dort angelegter Zwischenspeicher
würde die Daten eines Anwenders an den nächsten weiterreichen. Er entsteht deshalb in
`useState` innerhalb von `Anbieter`.

`frontend/tsconfig.json` erbt von **`tsconfig.base.json`**, nicht von `tsconfig.node.json`.
Das ist der Grund, aus dem die Basis frei von Modulsemantik gehalten wurde
([ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md)): Der Service braucht
`nodenext` mit CommonJS und Decorators, das Frontend Bundler-Auflösung mit
DOM-Bibliotheken. Gemeinsam ist ausschließlich die Typstrenge.

Das Frontend liegt **nicht** unter `services/`. Es ist kein Microservice im Sinne von
[ADR-0002](../adr/0002-repository-struktur.md) – keine eigene Datenbank, keine eigene
Rolle, kein angebotener Contract –, sondern ein Konsument der Services.

**Genau ein `paths`-Alias:** `@/*` auf `./src/*`, ohne `baseUrl`. Begründung und Abgrenzung
zu ADR-0006 Punkt 5 stehen in der
[Präzisierung vom 2026-08-06](../adr/0006-typescript-version-und-modulsemantik.md).

#### Warum das Frontend nicht mit `next dev` gestartet wird

Die Skripte `dev` und `start` rufen `frontend/scripts/next-mit-umgebung.mjs` auf. Das
Vorschaltskript lädt `infra/local/local.env` über `process.loadEnvFile()` und startet Next
anschließend als Kindprozess.

Der naheliegende Weg – `node --env-file=../infra/local/local.env … next dev` – **kann nicht
funktionieren**, und zwar unabhängig von Node- und Next-Version:

1. `next dev` liest die Node-Optionen des Elternprozesses und reicht sie an den geforkten
   Server weiter.
2. In `execArgv` bleiben dabei nur vier Inspector-Flags; alles andere wird zu `NODE_OPTIONS`
   zusammengesetzt.
3. Node lehnt `--env-file` in `NODE_OPTIONS` ab – eine Env-Datei muss geladen sein, *bevor*
   `NODE_OPTIONS` ausgewertet wird.

Der Fehler lautet dann `--env-file-if-exists= is not allowed in NODE_OPTIONS` und zeigt auf
`NODE_OPTIONS`, obwohl dort nie jemand etwas eingetragen hat. Das Vorschaltskript umgeht
das, indem es selbst ohne Node-Flags läuft: Es gibt nichts weiterzureichen, und die Werte
stehen bereits in der Prozessumgebung, die der Kindprozess erbt.

**`process.loadEnvFile()` überschreibt keine bereits gesetzten Variablen.** Echte
Umgebungen – CI, Container, Produktion – gewinnen damit immer gegen die lokale Datei. Fehlt
die Datei, läuft das Skript stillschweigend weiter; das ist außerhalb der lokalen
Entwicklung der Normalfall.

`build` läuft bewusst ohne Vorschaltskript: Konfigurationswerte gehören nicht in ein
Bauergebnis.

### Warum pnpm und nicht npm oder yarn

pnpm legt Abhängigkeiten inhaltsadressiert ab und verknüpft sie symbolisch. Das spart in
einem Monorepo mit mehreren Services erheblich Speicherplatz und Installationszeit.
Entscheidender ist die strikte Auflösung: Ein Paket kann nur importieren, was es selbst
als Abhängigkeit deklariert hat. Zufällig durch Hochziehen verfügbare Pakete – eine
häufige Quelle für Fehler, die erst in der CI auffallen – gibt es damit nicht.

Das Arbeitsbereichsprotokoll (`"workspace:*"`) ist zudem die in
[ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md) festgelegte Art, interne
Pakete zu referenzieren.

### Freigegebene Build-Skripte

pnpm führt `postinstall`-Skripte von Abhängigkeiten nicht automatisch aus. Freigaben
stehen in `pnpm-workspace.yaml` unter `allowBuilds` – einer Zuordnung von Paketmuster auf
Wahrheitswert:

| Paket | Wert | Grund |
|---|---|---|
| `@swc/core` | `true` | Verlinkt die plattformspezifische native Binärdatei; ohne sie funktioniert die Transformation der Tests nicht ([ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md)) |
| `esbuild` | `true` | `drizzle-kit` lädt damit die TypeScript-Konfiguration; das Skript verlinkt die plattformspezifische Binärdatei ([ADR-0009](../adr/0009-orm-und-migrationswerkzeug.md)) |
| `@scarf/scarf` | `false` | **Telemetrie.** Meldet bei jeder Installation Nutzungsdaten an einen Dritten – Paket, Version, Betriebssystem, IP, CI-Kennzeichen. Kommt über `swagger-ui-dist` zu `@nestjs/swagger`, hat keine funktionale Rolle |
| `ssh2` | `false` | Kommt über `dockerode` zu Testcontainers und dient Docker-Verbindungen über SSH. Wir sprechen den lokalen Socket an – nicht benötigt |
| `cpu-features` | `false` | Optionale native Abhängigkeit von `ssh2` zur Beschleunigung der SSH-Kryptografie. Kompiliert zur Installationszeit nativen Code, ohne Nutzen für uns |
| `protobufjs` | `false` | Das Skript erzeugt Hilfsdateien für die Kommandozeile; für die Nutzung als Bibliothek nicht erforderlich |

`false` bedeutet ausdrückliche Ablehnung. Ein geprüftes und abgelehntes Build-Skript ist
dadurch von einem unterscheidbar, das noch niemand angesehen hat – der Grund, warum
Ablehnungen ebenfalls in diese Tabelle gehören.

> Das Feld heißt erst ab pnpm 11 `allowBuilds`. Die früheren Felder
> `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies` und
> `ignoreDepScripts` wurden entfernt und wirken nicht mehr.

Jede Freigabe erlaubt die Ausführung beliebigen Codes zur Installationszeit – lokal wie in
der CI. Die Liste bleibt daher so kurz wie möglich, und jeder Eintrag braucht einen in
dieser Tabelle nachvollziehbaren Grund. Ein Eintrag ohne erkennbaren Grund ist im Review
zurückzuweisen.

Änderungen wirken sich auf `pnpm-lock.yaml` aus; beide Dateien gehören in denselben
Commit, sonst bricht `pnpm install --frozen-lockfile` in der Pipeline.

### Erzwungene Abhängigkeitsversionen (Overrides)

Transitive Abhängigkeiten mit bekannten Schwachstellen lassen sich nicht direkt anheben –
sie werden über `overrides` in `pnpm-workspace.yaml` erzwungen.

| Paket | Erzwungen | Grund | Entfernen, sobald |
|---|---|---|---|
| `find-my-way` | `>=9.7.0` | CVE-2026-47219 (HIGH, DDoS über HTTP/2) in 9.6.0; zweifach transitiv über `@nestjs/platform-fastify` und `fastify` | `@nestjs/platform-fastify` selbst ≥9.7.0 auflöst |
| `@nestjs/swagger>js-yaml` | `>=5.2.2` | GHSA-pm4m-ph32-ghv5 (HIGH, exponentielle Laufzeit bei Flow-Collections) in 5.2.1 | `@nestjs/swagger` selbst ≥5.2.2 auflöst |

**Overrides werden so eng wie möglich gebunden.** Die Schreibweise `Eltern>Kind` begrenzt
die Erzwingung auf einen Verwender. Im Fall von `js-yaml` liegen drei Fassungen im Baum;
ein pauschaler Override hätte auch die 4.x unter `@nestjs/cli` auf eine neue Hauptversion
gezwungen – ein Bruchrisiko dort, wo gar keine Schwachstelle besteht.

**Ein Override ist Schulden, kein Fix.** Er erzwingt eine Version an einer Stelle, an der
Upstream noch eine ältere deklariert. Bleibt er nach dem Nachziehen von Upstream stehen,
wird er zu einer unsichtbaren Festlegung, die irgendwann eine notwendige Aktualisierung
blockiert – ohne dass jemand den Zusammenhang noch kennt. Deshalb trägt jeder Eintrag eine
Entfernungsbedingung, und die Spalte ist Pflicht.

Änderungen wirken sich auf `pnpm-lock.yaml` aus; beide Dateien gehören in denselben
Commit.

### Mindestalter von Paketversionen

pnpm 11 verweigert standardmäßig Versionen, die erst vor kurzem veröffentlicht wurden
(`minimumReleaseAge`). Der Schutz zielt auf die gefährlichste Phase eines
Lieferkettenangriffs: das Fenster zwischen der Veröffentlichung einer übernommenen Version
und dem Zeitpunkt, an dem jemand es bemerkt. Wer immer sofort die neueste Version zieht,
ist zuverlässig als Erster betroffen.

**Die Schwelle ist nicht projektspezifisch gesetzt.** Sie ist die Voreinstellung von
pnpm; es gibt weder eine `.npmrc` noch einen Eintrag in `pnpm-workspace.yaml`.

Blockiert die Prüfung eine Installation, gibt es zwei zulässige Antworten:

1. **Die nächstältere Version nehmen.** Die Angabe bleibt ein normaler Bereich
   (`^10.1.2`), und pnpm wählt daraus die neueste Version, die die Schwelle passiert.
   Sobald die neuere alt genug ist, kommt sie ohne weiteres Zutun. Das ist der Regelfall.
2. **Warten.**

**`minimumReleaseAgeExclude` ist keine der beiden.** Der Eintrag hebt den Schutz für genau
die Version auf, für die er gedacht war. Er ist ausschließlich vertretbar, wenn die neue
Version eine ausgenutzte Schwachstelle schließt – dann ist das bekannte Risiko größer als
das unbekannte. Diese Begründung gehört dann in denselben Commit.

> **„Ich brauche die neueste" ist niemals ein Grund für einen Ausschluss.** Dieselbe Regel
> gilt für Unterdrückungen in der Sicherheitsprüfung, siehe
> [production-readiness.md](../operations/production-readiness.md).

### Parameter-Dekoratoren

`biome.json` setzt `javascript.parser.unsafeParameterDecoratorsEnabled` auf `true`. Ohne
diese Option scheitert Biome an NestJS-Konstruktoren wie
`constructor(@Inject(TOKEN) private readonly x: T)` mit
`Decorators are not valid here` – und überspringt die Datei dann auch beim Formatieren.

`unsafe` bezeichnet hier nicht ein Sicherheitsrisiko, sondern den Umstand, dass
Parameter-Dekoratoren eine nie standardisierte TypeScript-Syntax sind, die Biomes Parser
als experimentell behandelt. Vermeidbar ist sie mit NestJS nicht: `@Inject`, `@Body`,
`@Param` und `@Query` sind allesamt Parameter-Dekoratoren.

Ebenfalls in `biome.json` ausgenommen ist `**/drizzle` – die von `drizzle-kit` erzeugten
Momentaufnahmen unter `drizzle/meta/` würden sonst bei jedem Schemawechsel zwischen
Biome-Formatierung und Neuerzeugung hin- und herspringen.

### `format` genügt nicht

Die Import-Sortierung ist in Biome 2 keine Formatierungs-, sondern eine **Assist-Aktion**.
`biome format --write` wendet sie nicht an, `biome check` beanstandet sie aber. Ergebnis:
`pnpm format` läuft durch, `pnpm lint` bleibt rot – mit der Meldung
`assist/source/organizeImports  FIXABLE`.

Deshalb ist `pnpm lint:fix` (`biome check --write`) der Befehl der Wahl. Er umfasst
Formatierung, sichere Lint-Korrekturen und Assist-Aktionen in einem Durchgang.

### Warum Biome und nicht ESLint mit Prettier

Ein Werkzeug statt zweier, eine Konfigurationsdatei statt dreier, und deutlich schneller.
Für ein Projekt in dieser Größenordnung überwiegt das die größere Regelauswahl von
ESLint. Sollte eine Regel benötigt werden, die Biome nicht abbildet – etwa eine
projektspezifische Import-Grenze zwischen Services – wird ESLint ergänzend eingeführt und
diese Entscheidung hier vermerkt.

### Warum die TypeScript-Version exakt festgelegt ist

Siehe [ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md). Kurzfassung:
`@nestjs/cli` bringt TypeScript 5.9.3 als eigene Abhängigkeit mit. Ohne exakte Festlegung
prüfen Editor und Typecheck mit einer anderen Version als der Build übersetzt, was zu
Diagnosemeldungen führt, die sich nicht reproduzieren lassen.

---

## 2. Verfügbare Skripte

| Befehl | Wirkung |
|---|---|
| `pnpm lint` | Prüft Formatierung, Lint-Regeln und Import-Sortierung im gesamten Arbeitsbereich |
| `pnpm lint:fix` | Wendet alle sicheren Korrekturen an – **der Befehl nach dem Einfügen von Code** |
| `pnpm format` | Formatiert nur; wendet **keine** Lint- und Assist-Korrekturen an |
| `pnpm typecheck` | Typprüfung über alle Pakete |
| `pnpm test` | Tests über alle Pakete |
| `pnpm run infra:up` | Startet die lokale Infrastruktur |
| `pnpm run infra:down` | Stoppt die lokale Infrastruktur, behält die Daten |
| `pnpm run infra:reset` | Stoppt die Infrastruktur und **löscht das Datenvolumen** |
| `pnpm run infra:realm` | Wendet die Realm-Definition auf den laufenden Keycloak an |
| `pnpm run infra:fresh` | Vollständiger Neuaufbau: Reset, Start, **Migration**, Realm – in dieser Reihenfolge |

---

## 3. TypeScript-Konfiguration

Dreistufig aufgebaut, festgelegt in
[ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md):

```
tsconfig.base.json          nur Typstrenge, keine Modul- oder Zielsemantik
   ├─ tsconfig.node.json           Node/NestJS: nodenext, Decorators, types: ["node"]
   │     └─ services/*/tsconfig.json      nur outDir, rootDir, include, exclude
   └─ frontend/tsconfig.json       von Next.js verwaltet: Bundler-Auflösung, DOM
```

Zwei Regeln, deren Verletzung schwer zu diagnostizierende Fehler erzeugt:

1. **`outDir` und `rootDir` gehören ausschließlich in die Service-Konfiguration.**
   Relative Pfade in einer geerbten Konfiguration lösen sich gegen die Datei auf, in der
   sie stehen – stünden sie in `tsconfig.node.json`, würden alle Services in dasselbe
   Ausgabeverzeichnis übersetzen.
2. **Jeder Service benötigt `"type": "commonjs"` in seiner `package.json`.** Unter
   `module: nodenext` bestimmt dieses Feld das Ausgabeformat. Fehlt es, greift der
   Standardwert, und der Fehler tritt erst zur Laufzeit auf.

---

## 4. Keycloak-Realm-Verwaltung

Der Realm wird **deklarativ** verwaltet, nicht über Klicks in der Admin-Konsole und nicht
über ein imperatives Skript. Ein Skript beschreibt Schritte, eine Definition beschreibt
den Sollzustand – nur Letzteres lässt sich im Review lesen und wiederholt anwenden.

### Quelle der Wahrheit

```
infra/keycloak/realms/infrademand.json
```

Bewusst **außerhalb** von `infra/local/`: Rollen, Clients und Mapper werden in jeder
Umgebung gebraucht, nicht nur lokal. Änderungen in der Admin-Konsole gelten als nicht
existent, bis sie in dieser Datei stehen.

### Zwei Anwendungswege

| Situation | Mechanismus | Verhalten |
|---|---|---|
| Leerer Keycloak (Erstaufbau, `infra:reset`) | `--import-realm` beim Start | Legt den Realm an; **überspringt** ihn, wenn er bereits existiert |
| Bestehender Keycloak (nach jeder Änderung) | `pnpm run infra:realm` | Gleicht ab und aktualisiert, beliebig oft wiederholbar |

Der zweite Weg nutzt `keycloak-config-cli` und ist der maßgebliche: Er läuft lokal, in
der CI und später in jeder Umgebung – derselbe Mechanismus, kein zweiter Codepfad, der
auseinanderlaufen könnte.

Der Dienst ist in `compose.yaml` mit `profiles: ["config"]` hinterlegt und läuft daher
bei `infra:up` **nicht** mit. Er erscheint aus demselben Grund nicht in
`docker compose config --services` – dafür ist `--profile config` nötig.

### Tag-Schema von keycloak-config-cli

Die Images sind nach `<config-cli-Version>-<keycloak-Version>` benannt, etwa
`6.5.1-26` oder `6.5.1-26.5.5`. Ein Tag, das nur aus der Keycloak-Version besteht,
existiert **nicht** – eine naheliegende Verwechslung, die zu
`failed to resolve reference ... not found` führt.

Verwendet wird die Linien-Variante `-26`, nicht `latest-26`: Veränderliche Tags können
ihren Inhalt unbemerkt ändern (siehe PROD-022).

### Grenzen

Die Definition enthält derzeit umgebungsspezifische Werte (Weiterleitungs-URLs auf
`localhost:3000`) und einen Testbenutzer mit Passwort. Beides ist für die lokale Umgebung
vertretbar und in
[production-readiness.md](../operations/production-readiness.md) als PROD-007 und
PROD-011 erfasst. Die Auslagerung erfolgt über Variablenersetzung
(`IMPORT_VARSUBSTITUTION_ENABLED=true`), sobald die erste nicht-lokale Umgebung entsteht.

---

## 5. Geplant

Diese Werkzeuge sind vorgesehen, aber noch nicht eingerichtet. Sie werden mit dem
angegebenen Meilenstein ergänzt.

| Werkzeug | Zweck | Ab |
|---|---|---|
| Bibliothek für serverseitige Anmeldung | Backend-for-Frontend ([ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md)) | M2.3 |
| OpenAPI-Client-Generator | Typsicherer Client aus dem eingecheckten Contract ([ADR-0005](../adr/0005-api-first-workflow.md)) | M2.4 |
| OpenTelemetry | Ablaufverfolgung und Metriken (CLAUDE.md §14) | offen |
| SAST / DAST | Statische und dynamische Sicherheitsprüfung (CLAUDE.md §13, `PROD-025`) | offen |
| `@nestjs/terminus` | Bereitschaftsprüfung mit Datenbank- und JWKS-Kontrolle (`PROD-029`) | offen |
| ~~`ajv`~~ | **Nicht eingeführt.** Begründung siehe unten | – |
| JSONLogic oder `json-rules-engine` | Regelauswertung für Workflow-Übergänge (CLAUDE.md §7) | M4 |
| OPA oder OpenFGA | Feingranulare Autorisierung ([ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)) | M5 |

### Warum kein `ajv` für die dynamischen Attribute

Mit M3.3 entstand die Laufzeitprüfung aus CLAUDE.md §6. Sie ist **von Hand geschrieben**,
nicht über JSON Schema mit `ajv` – anders als hier ursprünglich vorgesehen. Drei Gründe:

- **Der Typsatz ist geschlossen und flach.** Sechs skalare Typen, keine Verschachtelung,
  keine Komposition. Die Prüfung ist rund hundert Zeilen; ein Schemagenerator davor wäre
  mehr Bewegung als Ertrag.
- **Die Form der Fehler zählt mehr als die Ausdrucksstärke.** Die Oberfläche braucht
  feldbezogene Meldungen auf Deutsch. `ajv`-Fehler (`instancePath`, `keyword`, `params`)
  müssten dafür ohnehin übersetzt werden – die Übersetzungsschicht wäre umfangreicher als
  die Prüfung selbst.
- **Geteilt wird die Definition, nicht ein Schema.** Backend und Frontend lesen beide
  `dataType`, `required` und `allowedValues` aus derselben Attributdefinition. Ein
  zusätzlich abgeleitetes JSON Schema wäre eine zweite Darstellung desselben Sachverhalts.

§6 nennt JSON Schema mit „z. B.", also als Beispiel und nicht als Vorgabe.

**Wann die Entscheidung neu zu treffen ist:** Sobald Attributdefinitionen zusammensetzbare
Einschränkungen tragen – Wertebereiche, Muster, Formate, bedingte Pflichtfelder. Dann
wächst eine handgeschriebene Prüfung schneller als ein Schema, und `ajv` wird die
kleinere Lösung.

---

## 6. Konventionen

### Commit-Nachrichten

[Conventional Commits](https://www.conventionalcommits.org/): `<typ>(<bereich>): <text>`

Zulässige Typen: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.

Der Bereich ist der Service- oder Paketname, sofern zutreffend:

```
feat(requirement): Anlegen von Anforderungen ueber POST /v1/requirements
docs(adr): ADR-0006 zu TypeScript-Version und Modulsemantik
chore: Monorepo-Geruest und lokale Infrastruktur
```

Der Nutzen ist nicht Kosmetik: Er ermöglicht die maschinelle Erzeugung von
Änderungsprotokollen und die Ableitung von Versionssprüngen – beides Voraussetzung für
die in CLAUDE.md §4 geforderten versionierten Schnittstellen.

### Zeilenenden

Verbindlich LF, erzwungen über `.gitattributes` (`* text=auto eol=lf`) – nicht über
lokale Git-Einstellungen.

Der Unterschied ist wesentlich: `core.autocrlf input` wandelt beim Commit um, aber nicht
beim Auschecken. Ein Windows-Arbeitsplatz hätte damit CRLF im Arbeitsverzeichnis und LF
im Repository. Werkzeuge, die das Arbeitsverzeichnis prüfen – Biome, später auch
Testrunner – melden dann Fehler, die die CI nicht sieht, weil sie auf einem frischen
Auscheckvorgang arbeitet. `.gitattributes` liegt im Repository und gilt damit für alle,
während lokale Einstellungen jeder Beteiligte selbst setzen müsste.

### Branch-Benennung und Arbeitsablauf

`<typ>/<kurzbeschreibung>`, etwa `feat/m0-foundation`, `fix/keycloak-realm-import`.

Es wird nicht direkt auf `main` gearbeitet:

```
Feature-Branch  →  Pull Request  →  CI gruen  →  Merge nach main
```

Die Pipeline wird durch den **Pull Request** ausgelöst, nicht durch den Push auf den
Branch. Ein Push auf einen Feature-Branch startet bewusst nichts – sonst liefe die
Pipeline bei offenem Pull Request zweimal parallel für denselben Stand. Zum Ausprobieren
der Pipeline selbst steht `workflow_dispatch` bereit (*Actions → CI → Run workflow*).

### Schutz des `main`-Branch

Der Workflow **berichtet** nur – er verhindert nichts. Ohne Ruleset lässt sich ein Pull
Request mit roten Prüfungen mergen und direkt auf `main` pushen. Erst das Ruleset macht
aus dem Signal ein Tor; ohne es wäre die Aussage aus
[ADR-0005](../adr/0005-api-first-workflow.md), dass eine abweichende Spezifikation den
Build bricht, nicht belastbar.

Die Regel liegt als `.github/rulesets/main.json` im Repository und wird angewandt mit:

```bash
gh api --method POST /repos/kn0rr/InfraDemand/rulesets --input .github/rulesets/main.json
```

**GitHub liest diese Datei nicht selbst.** Sie ist überprüfbare Dokumentation plus ein
reproduzierbarer Anwendungsbefehl – kein GitOps. Wer die Regel in der Oberfläche ändert,
weicht unbemerkt davon ab.

Zwei Fallstricke:

- Der `context` einer erforderlichen Prüfung ist der **Anzeigename** des Jobs (`name:`),
  nicht dessen ID – also „Lint und Formatierung", nicht `lint`. Bei einer Abweichung
  wartet jeder Pull Request dauerhaft auf eine Prüfung, die nie eintrifft.
- Das Ruleset kann erst sinnvoll gesetzt werden, **nachdem** die Prüfungen einmal
  gelaufen sind – vorher kennt GitHub ihre Namen nicht.

`required_approving_review_count` steht bewusst auf `0`: Eigene Pull Requests lassen sich
nicht selbst freigeben, bei `1` wäre die einzige beteiligte Person ausgesperrt. Der
Zwang zum Pull Request bleibt davon unberührt.

### Testansatz

CLAUDE.md §2 fordert Test-Driven Design: Tests entstehen vor beziehungsweise parallel zur
Implementierung. Konkret für dieses Projekt bedeutet das, dass ein neuer Endpunkt mit
einem fehlschlagenden Integrationstest beginnt, der gegen eine echte, über Testcontainers
bereitgestellte Datenbank läuft – nicht gegen Attrappen.

Begründung: Die schwierigen Anteile dieser Plattform liegen in der Persistenz
(JSONB-Abfragen, Migrationen, Historisierung) und in der Autorisierung. Genau diese
Anteile prüft ein Test gegen Attrappen nicht.
