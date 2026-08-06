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
| Keycloak | 26.7.0 | `infra/local/compose.yaml`, `infra/keycloak/realms/` | Identitätsverwaltung |
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
| Vitest | 4.1.x | `vitest.config.ts` | Testrunner |
| SWC | 1.15.x | `.swcrc` | Transformation der Tests inkl. Decorator-Metadaten |
| supertest | 7.2.x | – | HTTP-Aufrufe gegen die laufende Anwendung im Test |

**SWC ist nicht optional.** Der Standardtransformator von Vitest ist esbuild, und esbuild
unterstützt `emitDecoratorMetadata` nicht. Ohne SWC fehlen NestJS die Typinformationen zur
Auflösung seiner Abhängigkeiten; der Fehler erscheint als `Cannot resolve dependency at
index [0]` und weist damit auf die falsche Stelle. Siehe
[ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md).

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

**Ein Override ist Schulden, kein Fix.** Er erzwingt eine Version an einer Stelle, an der
Upstream noch eine ältere deklariert. Bleibt er nach dem Nachziehen von Upstream stehen,
wird er zu einer unsichtbaren Festlegung, die irgendwann eine notwendige Aktualisierung
blockiert – ohne dass jemand den Zusammenhang noch kennt. Deshalb trägt jeder Eintrag eine
Entfernungsbedingung, und die Spalte ist Pflicht.

Änderungen wirken sich auf `pnpm-lock.yaml` aus; beide Dateien gehören in denselben
Commit.

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
| Testcontainers | Integrationstests gegen echte PostgreSQL-Instanz ([ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md)) | M1.3 |
| Drizzle oder MikroORM | Datenzugriff und Migrationen ([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)) | M1.3 |
| `@nestjs/swagger` | Erzeugung des OpenAPI-Contracts ([ADR-0005](../adr/0005-api-first-workflow.md)) | M1.4 |
| `oasdiff` | Erkennung inkompatibler Contract-Änderungen | M1.4 |
| OpenTelemetry | Ablaufverfolgung und Metriken (CLAUDE.md §14) | M1 |
| SAST / DAST | Statische und dynamische Sicherheitsprüfung (CLAUDE.md §13, `PROD-025`) | M1 / M2 |
| Next.js | Frontend | M2 |
| `ajv` | Laufzeitvalidierung dynamischer Attribute gegen JSON Schema (CLAUDE.md §6) | M3 |
| JSONLogic oder `json-rules-engine` | Regelauswertung für Workflow-Übergänge (CLAUDE.md §7) | M4 |
| OPA oder OpenFGA | Feingranulare Autorisierung ([ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)) | M5 |

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
