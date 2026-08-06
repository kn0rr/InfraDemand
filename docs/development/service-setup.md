# Einen neuen Service anlegen

Diese Anleitung beschreibt, wie ein weiterer Microservice im Monorepo entsteht. Sie ist
bewusst als **Prüfliste** geschrieben: Was hier fehlt, wird beim zweiten und dritten
Service anders gemacht als beim ersten – und genau daraus entsteht Uneinheitlichkeit, die
später niemand mehr aufräumt.

**Geltungsstand:** 2026-08-04. Referenzumsetzung ist
[`services/requirement`](../../services/requirement/README.md).

> Ein Service wird erst angelegt, wenn eine fachliche Anforderung ihn benötigt – nicht,
> weil er in CLAUDE.md §5 aufgeführt ist
> ([ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md)).

---

## 1. Verzeichnis und Paket

```
services/<name>/
```

`package.json`:

```json
{
  "name": "@infrademand/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/main.js",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

**`"type": "commonjs"` ist nicht optional.** Unter `module: nodenext` bestimmt dieses Feld
das Ausgabeformat. Fehlt es, greift ein Vorgabewert und der Fehler tritt erst zur Laufzeit
auf ([ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md)).

Die Skriptnamen müssen **identisch** zu denen der bestehenden Services sein – `pnpm -r test`
und `pnpm -r typecheck` im Wurzelverzeichnis laufen über alle Pakete und überspringen
stillschweigend, was anders heißt.

```powershell
pnpm install
```

Registriert das Paket im Arbeitsbereich. `pnpm-workspace.yaml` muss nicht angepasst
werden, `services/*` deckt es ab.

---

## 2. Abhängigkeiten

```powershell
pnpm --filter @infrademand/<name> add @nestjs/common @nestjs/core @nestjs/platform-fastify @nestjs/config reflect-metadata rxjs
```

```powershell
pnpm --filter @infrademand/<name> add -D @nestjs/cli @nestjs/schematics @nestjs/testing @swc/core unplugin-swc vitest supertest @types/supertest
```

Fastify statt Express ist gesetzt ([ADR-0001](../adr/0001-backend-sprache-und-framework.md)).

---

## 3. Konfigurationsdateien

Vier Dateien, alle im Paketwurzelverzeichnis. Übernimm sie aus
`services/requirement/` – Abweichungen sind ein Fehler, kein Gestaltungsspielraum.

| Datei | Zweck | Fallstrick |
|---|---|---|
| `tsconfig.json` | Typprüfung über `src/` **und** `test/` | `outDir`/`rootDir` gehören hierhin, nicht in die geerbte Konfiguration |
| `tsconfig.build.json` | Übersetzung, ohne Tests | Sonst landen Tests im Container-Image |
| `nest-cli.json` | verweist auf `tsconfig.build.json` | – |
| `.swcrc` | Decorator-Metadaten für Tests | Muss im **Paketwurzelverzeichnis** liegen, mit führendem Punkt |
| `vitest.config.mts` | Testrunner mit SWC-Transformation | Endung `.mts`; `swc.vite()` als Plugin **und** `oxc: false` |

Zu `vitest.config.mts` – zwei Punkte, die je einen halben Tag Suche kosten:

- **Die Endung ist `.mts`, nicht `.ts`.** Das Paket ist CommonJS, die Konfigurationsdatei
  nutzt ESM-Syntax; `.mts` erzwingt ESM unabhängig vom `type`-Feld.
- **`oxc: false` ist erforderlich.** Der eingebaute Transformator von Vitest 4 ist Oxc und
  unterstützt `emitDecoratorMetadata` nicht. `unplugin-swc` schaltet ihn über
  `esbuild: false` ab, was seit Vitest 4 wirkungslos ist.
- **Das Plugin wird mit `swc.vite({ module: { type: "es6" } })` aufgerufen.** Ohne diese
  Überschreibung erzeugt SWC nach `.swcrc` CommonJS-Ausgabe; die daraus entstehenden
  `require()`-Aufrufe löst Vitest nach Node-Regeln auf, die keine `.ts`-Endung kennen.
  Symptom: `Cannot find module '../src/...'` mit `Require stack:`, obwohl die Datei
  existiert. `.swcrc` bleibt dabei auf `commonjs` – dieser Wert gilt dem Build, nicht dem
  Test.

Zu `outDir` und `rootDir`: Relative Pfade in einer über `extends` geerbten Konfiguration
lösen sich gegen die Datei auf, in der sie **stehen**. Stünden sie in
`tsconfig.node.json`, würden alle Services in dasselbe Ausgabeverzeichnis übersetzen und
sich gegenseitig überschreiben.

---

## 4. Datenbank

Jeder Service erhält **eine eigene Datenbank und eine eigene Rolle**
([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)). Ergänze
`infra/local/postgres/init/01-databases.sql`:

```sql
CREATE ROLE <name> WITH LOGIN PASSWORD '<name>';
CREATE DATABASE <name> OWNER <name>;
```

Die Skripte in `docker-entrypoint-initdb.d` laufen **ausschließlich bei leerem
Datenverzeichnis**. Nach der Ergänzung:

```powershell
pnpm run infra:reset
pnpm run infra:up
```

Die Rollentrennung gilt auch lokal. Ein gemeinsamer Superuser wäre bequemer und würde die
Servicegrenze genau dort aufweichen, wo sie verletzt wird.

---

## 5. Identität

Ein Service, der eine API anbietet, braucht einen **Zielgruppen-Client** in
`infra/keycloak/realms/infrademand.json`:

```json
{
  "clientId": "<name>-api",
  "name": "<Name> Service (Zielgruppe)",
  "enabled": true,
  "publicClient": false,
  "standardFlowEnabled": false,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false
}
```

Dazu ein Audience-Mapper im aufrufenden Client, sonst enthält das Token keinen
`aud`-Anspruch und der Service lehnt es ab, obwohl Anmeldung und Rollen stimmen.

> **Wird der Service vom Frontend aufgerufen**, braucht der Client `frontend` einen
> **eigenen Audience-Mapper für diesen Service** – zusätzlich zu den bereits vorhandenen.
> Jeder Service prüft ausschließlich auf seine eigene Zielgruppe
> ([ADR-0013](../adr/0013-frontend-zuschnitt-und-zugriffsweg.md)). Fehlt der Mapper,
> lehnt der neue Service jedes Token ab – mit einer Meldung, die auf den Service zeigt
> statt auf den Realm.
>
> Ebenso ist **CORS für die Frontend-Herkunft** im Service zu konfigurieren. Der Browser
> spricht die Service-APIs direkt an; ohne CORS scheitert jeder Aufruf aus der
> Oberfläche.

Ruft der Service **andere Services** auf, braucht er zusätzlich einen eigenen
**Service Account** – einen vertraulichen Client mit aktiviertem Client-Credentials-Grant
und eigenen, minimal notwendigen Rollen (CLAUDE.md §4). Kein geteilter technischer
Account.

> ⚠️ Dessen Geheimnis darf **nicht** in die Realm-Datei. Das Repository ist öffentlich –
> siehe `PROD-012` in [production-readiness.md](../operations/production-readiness.md).
> Vorher Variablenersetzung einrichten (`IMPORT_VARSUBSTITUTION_ENABLED=true`).

Anwenden:

```powershell
pnpm run infra:realm
```

---

## 6. Erster Test

Test-Driven Design (CLAUDE.md §2): Der Service beginnt mit einem **fehlschlagenden
Integrationstest**, nicht mit der Implementierung
([ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md)).

Reihenfolge des ersten vertikalen Durchstichs:

1. `GET /health` liefert 200 – beweist, dass Anwendung und Test-Harness stehen.
   **Der Controller muss dabei mindestens eine über den Konstruktor injizierte
   Abhängigkeit haben** (etwa einen `HealthService`). Ohne Dependency Injection wird der
   Test auch dann grün, wenn die Decorator-Metadaten fehlen – der Fehler tritt dann erst
   beim Auth-Guard auf, weit entfernt von seiner Ursache.
2. Fachlicher Endpunkt **ohne** Token → 401
3. Derselbe Endpunkt **mit** gültigem Token → 200

Bei Fastify im Test zwingend nach `app.init()`:

```
await app.getHttpAdapter().getInstance().ready();
```

---

## 7. In die CI aufnehmen

Der Job `test` in `.github/workflows/ci.yml` läuft über `pnpm -r test` und erfasst das
neue Paket automatisch – **sofern** die Skriptnamen aus Schritt 1 eingehalten wurden.

Für Container-Images ist nichts zu tun: Der Job `security` leitet die zu prüfende Liste
über `docker compose config --images` aus `infra/local/compose.yaml` ab. Was dort steht,
wird geprüft.

> Das war nicht immer so. Bis 2026-08-04 stand die Liste fest im Workflow und lief
> auseinander: Keycloak war in Compose bereits auf 26.7.0 angehoben, während die CI
> weiterhin das nicht mehr verwendete 26.4 prüfte und dessen Schwachstellen meldete.
> Deshalb gilt für jede Art von Liste in diesem Repository: **ableiten statt
> duplizieren.**

---

## 8. Dokumentation

Ohne diesen Schritt gilt der Service als nicht angelegt:

- [ ] `services/<name>/README.md` nach dem Muster von
      [`services/requirement/README.md`](../../services/requirement/README.md)
- [ ] [`docs/architecture/services.md`](../architecture/services.md) – Status und
      Entitäten eintragen
- [ ] [`docs/development/tooling.md`](tooling.md) – nur bei **neuen** Werkzeugen
- [ ] [`docs/operations/production-readiness.md`](../operations/production-readiness.md) –
      jede genommene Abkürzung, jedes triviale Zugangsdatum, jeder abgeschaltete
      Mechanismus
- [ ] ADR, falls dabei eine Entscheidung mit struktureller Wirkung getroffen wurde

---

## Prüfliste zum Abhaken

- [ ] Verzeichnis unter `services/<name>/`
- [ ] `package.json` mit `"type": "commonjs"` und den vereinbarten Skriptnamen
- [ ] Abhängigkeiten installiert
- [ ] `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.swcrc`, `vitest.config.ts`
- [ ] Eigene Datenbank und Rolle, `infra:reset` durchgeführt
- [ ] Zielgruppen-Client im Realm, `infra:realm` angewandt
- [ ] Audience-Mapper im Client `frontend` ergänzt, falls die Oberfläche den Service aufruft
- [ ] CORS für die Frontend-Herkunft konfiguriert
- [ ] Erster Test rot, dann grün
- [ ] Kein Import aus einem anderen Service, kein fremder Datenbankzugriff
- [ ] Dokumentation nach Abschnitt 8
