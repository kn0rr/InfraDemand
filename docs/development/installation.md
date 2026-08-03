# Installationsanleitung

Diese Anleitung führt von einem frischen Rechner zu einer lauffähigen lokalen
Entwicklungsumgebung.

**Zielplattform:** Windows 11 mit PowerShell. Die Schritte sind mit Ausnahme der
Installationsbefehle plattformunabhängig; für macOS und Linux stehen die Abweichungen
jeweils dabei.

**Geltungsstand:** 2026-07-31, Meilenstein M0.

---

## 1. Übersicht der benötigten Werkzeuge

| Werkzeug | Version | Zweck |
|---|---|---|
| Node.js | 24.x (Active LTS) | Laufzeit für Services und Frontend |
| pnpm | 11.x | Paketverwaltung, Arbeitsbereichsverwaltung |
| Docker Desktop | aktuell, WSL2-Backend | Lokale Infrastruktur, Integrationstests |
| Git | aktuell | Versionsverwaltung |

Nach der Installation werden folgende Versionen im Projekt verwendet – sie werden über
das Repository festgelegt und nicht von Hand installiert:

| Bestandteil | Version | Festgelegt in |
|---|---|---|
| TypeScript | 5.9.3 (exakt) | `package.json`, siehe [ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md) |
| Biome | 2.5.6 | `package.json` |
| PostgreSQL | 18 (Alpine) | `infra/local/compose.yaml` |
| Keycloak | 26.4 | `infra/local/compose.yaml` |

---

## 2. Node.js

Verwende einen Versionsmanager statt des Installationspakets. Über die Projektlaufzeit
wird die Node-Version mehrfach wechseln, und die Festlegung gehört ins Repository
(`.node-version`), nicht auf den Rechner.

### Windows

```powershell
winget install Schniz.fnm
```

Shell-Integration einmalig im PowerShell-Profil eintragen:

```powershell
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }
Add-Content -Path $PROFILE -Value 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression' -Encoding utf8
```

**Neues Terminal öffnen**, dann:

```powershell
fnm install 24
fnm default 24
fnm use 24
```

### macOS / Linux

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

Anschließend `fnm install 24 && fnm default 24`.

### Prüfen

```powershell
node --version
```

Erwartet: `v24.x.x` (geprüft mit `v24.18.0`).

> **Warum Node 24 und nicht neuer:** Node 24 ist die aktive Langzeitunterstützungsversion.
> Für eine Plattform mit mehrjähriger Laufzeit ist LTS die richtige Wahl; die jeweils
> aktuelle Nicht-LTS-Version wird nicht verwendet.

---

## 3. pnpm

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

Falls Corepack in der verwendeten Node-Distribution nicht enthalten ist:

```powershell
winget install pnpm.pnpm
```

### Prüfen

```powershell
pnpm --version
```

Erwartet: `11.x` (geprüft mit `11.18.0`).

---

## 4. Docker Desktop

Erforderlich für die lokale Infrastruktur und – ab Meilenstein M1 – für die
Integrationstests mit Testcontainers.

1. Docker Desktop installieren.
2. **WSL2-Backend aktivieren:** *Settings → General → „Use the WSL 2 based engine"*.
   Mit dem Hyper-V-Backend sind Testcontainers-Läufe deutlich langsamer.
3. Docker Desktop starten. Die Container laufen nur, solange Docker Desktop läuft.

### Prüfen

```powershell
docker --version
docker compose version
```

---

## 5. Git

```powershell
git --version
```

Zeilenenden unter Windows einmalig konfigurieren:

```powershell
git config --global core.autocrlf input
```

Ohne diese Einstellung erzeugen die Container-Builds später Unterschiede, die
ausschließlich aus Zeilenenden bestehen. Das Repository legt über `.editorconfig`
zusätzlich `lf` als Zeilenende fest.

---

## 6. Repository einrichten

```powershell
git clone <repository-url> InfraDemand
cd InfraDemand
pnpm install
```

`pnpm install` liest `pnpm-workspace.yaml` und richtet den gesamten Arbeitsbereich ein –
Services, geteilte Pakete und Frontend in einem Durchgang.

### Prüfen

```powershell
pnpm lint
```

Läuft ohne Befund durch.

---

## 7. Lokale Infrastruktur starten

Die lokale Umgebung besteht aus PostgreSQL und Keycloak, beschrieben in
`infra/local/compose.yaml`.

```powershell
pnpm run infra:up
```

Der **erste** Start dauert 30–60 Sekunden: PostgreSQL initialisiert sein Datenverzeichnis
und legt über `infra/local/postgres/init/01-databases.sql` die Datenbanken an,
anschließend erzeugt Keycloak sein Schema.

### Verfügbare Skripte

| Befehl | Wirkung |
|---|---|
| `pnpm run infra:up` | Startet die Container im Hintergrund |
| `pnpm run infra:down` | Stoppt die Container, **behält** die Daten |
| `pnpm run infra:reset` | Stoppt die Container und **löscht das Datenvolumen** |

> `infra:reset` verwirft die gesamte lokale Datenbank einschließlich der
> Keycloak-Realm-Konfiguration. Das ist der Weg, um eine saubere Erstinitialisierung zu
> erzwingen – und der einzige Befehl hier, der Daten vernichtet.

---

## 8. Verifikation

Alle vier Prüfungen müssen erfolgreich sein, bevor die Umgebung als eingerichtet gilt.

**1. Container laufen**

```powershell
docker compose -f infra/local/compose.yaml ps
```

Erwartet: beide Container `Up`, PostgreSQL mit dem Zusatz `(healthy)`.

**2. Datenbanken und Rollen wurden angelegt**

```powershell
docker compose -f infra/local/compose.yaml exec postgres psql -U postgres -c "\l"
```

Erwartet: die Datenbanken `keycloak` (Eigentümer `keycloak`) und `requirement`
(Eigentümer `requirement`) zusätzlich zu den drei Standarddatenbanken.

**3. Keycloak beantwortet die OIDC-Erkennung**

```powershell
(Invoke-RestMethod http://localhost:8080/realms/master/.well-known/openid-configuration).issuer
```

Erwartet: `http://localhost:8080/realms/master`.

Dies ist die wichtigste Prüfung – dieses Dokument ist die Grundlage, gegen die die
Services ihre Token validieren.

**4. Konfiguration übersteht einen Neustart**

```powershell
pnpm run infra:down
pnpm run infra:up
```

Keycloak muss ohne erneute Schema-Erzeugung hochkommen. Damit ist belegt, dass die
Konfiguration in PostgreSQL persistiert wird und nicht bei jedem Neustart verloren geht.

---

## 9. Lokale Zugänge

> Diese Zugangsdaten gelten **ausschließlich lokal**. Sie sind bewusst trivial und dürfen
> in keiner anderen Umgebung verwendet werden. Für alle nicht-lokalen Umgebungen gilt
> CLAUDE.md §13: HashiCorp Vault.

| Dienst | Adresse | Zugang |
|---|---|---|
| Keycloak Administration | http://localhost:8080 | `admin` / `admin` |
| Keycloak Verwaltungsport (Health, Metrics) | http://localhost:9000 | – |
| PostgreSQL (Superuser) | `localhost:5432` | `postgres` / `postgres` |
| Datenbank `keycloak` | `localhost:5432/keycloak` | `keycloak` / `keycloak` |
| Datenbank `requirement` | `localhost:5432/requirement` | `requirement` / `requirement` |

Zur Rollentrennung siehe [ADR-0003](../adr/0003-datenbank-und-datenhoheit.md): Jeder
Service verwendet ausschließlich seine eigene Rolle und Datenbank – auch lokal.

---

## 10. Häufige Fehler

Die folgenden Fälle sind beim Aufbau der Umgebung tatsächlich aufgetreten und hier
dokumentiert, weil ihre Fehlermeldungen nicht auf die Ursache zeigen.

### `dependency failed to start: container id-postgres exited (1)`

Im Log steht sinngemäß, es befänden sich Daten in `/var/lib/postgresql/data`
(„unused mount/volume").

**Ursache:** Ab PostgreSQL 18 liegt das Datenverzeichnis unter
`/var/lib/postgresql/18/docker`. Ein Einhängepunkt am alten Pfad
`/var/lib/postgresql/data` löst eine Schutzabfrage aus, die einen versehentlichen
Hauptversionswechsel verhindern soll.

**Behebung:** In `infra/local/compose.yaml` muss das Volumen auf das **übergeordnete**
Verzeichnis zeigen:

```yaml
- postgres-data:/var/lib/postgresql
```

### Die Datenbanken `keycloak` und `requirement` fehlen

Keycloak beendet sich mit Exit-Code 1, im PostgreSQL-Log steht
`Role "keycloak" does not exist`.

**Ursache 1 – häufigster Fall:** Die Datei
`infra/local/postgres/init/01-databases.sql` ist leer. PostgreSQL protokolliert
`running /docker-entrypoint-initdb.d/01-databases.sql` auch dann, wenn die Datei keinen
Inhalt hat, und fährt ohne Fehler fort. Der Fehler wird erst durch den Folgedienst
sichtbar.

```powershell
Get-ChildItem infra/local/postgres/init/01-databases.sql | Select-Object Name,Length
```

`Length` muss größer als 0 sein.

**Ursache 2:** Das Datenverzeichnis war bereits initialisiert. Die Skripte in
`docker-entrypoint-initdb.d` laufen **ausschließlich bei leerem Datenverzeichnis**.

**Behebung in beiden Fällen:**

```powershell
pnpm run infra:reset
pnpm run infra:up
```

Die Anweisungen von Hand über `psql` einzuspielen behebt zwar das Symptom, verdeckt aber,
dass die Umgebung nicht allein aus dem Repository reproduzierbar ist. Deshalb der Weg
über den vollständigen Neuaufbau.

### `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`

Docker Desktop läuft nicht. Starten und die Befehle wiederholen.

### `Bind for 0.0.0.0:5432 failed: port is already allocated`

Auf dem Rechner läuft bereits eine PostgreSQL-Installation. In
`infra/local/compose.yaml` die Portzuordnung auf `"5433:5432"` ändern und die
Verbindungszeichenfolgen der Services anpassen. Der Keycloak-Container spricht PostgreSQL
containerintern über Port 5432 an – dort ändert sich nichts.

### `Cannot find module … or its corresponding type declarations`

Obwohl das Paket installiert ist. Ursache ist in der Regel eine
TypeScript-Konfiguration, die `"exports"`-Felder nicht auswertet. Siehe
[ADR-0006](../adr/0006-typescript-version-und-modulsemantik.md): `module` und
`moduleResolution` müssen beide auf `nodenext` stehen.

---

## 11. Nächste Schritte

Nach erfolgreicher Verifikation:

- Aufbau und Servicelandschaft: [`../architecture/README.md`](../architecture/README.md)
- Werkzeugkette und Konventionen: [`tooling.md`](tooling.md)
- Getroffene Entscheidungen und ihre Begründung: [`../adr/README.md`](../adr/README.md)
