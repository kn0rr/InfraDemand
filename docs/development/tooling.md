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
| Keycloak | 26.4 | `infra/local/compose.yaml`, `infra/keycloak/realms/` | Identitätsverwaltung |
| keycloak-config-cli | 6.5.1-26 | `infra/local/compose.yaml` (Profil `config`) | Idempotente Anwendung der Realm-Definition |
| EditorConfig | – | `.editorconfig` | Editorübergreifende Grundeinstellungen |
| Git-Attribute | – | `.gitattributes` | Erzwingt LF-Zeilenenden in Repository **und** Arbeitsverzeichnis |

### Warum pnpm und nicht npm oder yarn

pnpm legt Abhängigkeiten inhaltsadressiert ab und verknüpft sie symbolisch. Das spart in
einem Monorepo mit mehreren Services erheblich Speicherplatz und Installationszeit.
Entscheidender ist die strikte Auflösung: Ein Paket kann nur importieren, was es selbst
als Abhängigkeit deklariert hat. Zufällig durch Hochziehen verfügbare Pakete – eine
häufige Quelle für Fehler, die erst in der CI auffallen – gibt es damit nicht.

Das Arbeitsbereichsprotokoll (`"workspace:*"`) ist zudem die in
[ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md) festgelegte Art, interne
Pakete zu referenzieren.

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
| `pnpm lint` | Prüft Formatierung und Lint-Regeln im gesamten Arbeitsbereich |
| `pnpm format` | Formatiert alle Dateien |
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
| NestJS | Anwendungsframework der Services | M1 |
| Vitest | Testrunner | M1 |
| Testcontainers | Integrationstests gegen echte PostgreSQL-Instanz | M1 |
| Drizzle oder MikroORM | Datenzugriff und Migrationen ([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)) | M1 |
| `@nestjs/swagger` | Erzeugung des OpenAPI-Contracts ([ADR-0005](../adr/0005-api-first-workflow.md)) | M1 |
| GitHub Actions | CI-Pipeline | M0, Schritt 3 |
| `oasdiff` | Erkennung inkompatibler Contract-Änderungen | M0, Schritt 3 |
| Trivy | Abhängigkeits- und Container-Prüfung (CLAUDE.md §13) | M0, Schritt 3 |
| Renovate | Automatisierte Abhängigkeitsaktualisierung | M0, Schritt 3 |
| OpenTelemetry | Ablaufverfolgung und Metriken (CLAUDE.md §14) | M1 |
| Next.js | Frontend | M2 |

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

Die Jobs `lint`, `realm` und `security` sind als erforderliche Prüfungen für `main`
gesetzt. Das ist eine Repository-Einstellung, kein Bestandteil des Repositories – ohne
sie wäre die Pipeline eine Empfehlung statt eines Tors, und Aussagen wie „eine abweichende
Spezifikation bricht den Build" ([ADR-0005](../adr/0005-api-first-workflow.md)) wären
nicht belastbar.

### Testansatz

CLAUDE.md §2 fordert Test-Driven Design: Tests entstehen vor beziehungsweise parallel zur
Implementierung. Konkret für dieses Projekt bedeutet das, dass ein neuer Endpunkt mit
einem fehlschlagenden Integrationstest beginnt, der gegen eine echte, über Testcontainers
bereitgestellte Datenbank läuft – nicht gegen Attrappen.

Begründung: Die schwierigen Anteile dieser Plattform liegen in der Persistenz
(JSONB-Abfragen, Migrationen, Historisierung) und in der Autorisierung. Genau diese
Anteile prüft ein Test gegen Attrappen nicht.
