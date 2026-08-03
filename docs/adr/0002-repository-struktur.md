# ADR-0002: Repository-Struktur: Monorepo

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §4, §14
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

CLAUDE.md §4 fordert je Service eine eigene fachliche Verantwortung, eigene API, eigene
Datenhaltung und **unabhängiges Deployment**. §14 fordert GitOps und CI/CD.

Daraus folgt nicht zwingend eine Aufteilung auf mehrere Repositories. Unabhängiges
Deployment ist eine Eigenschaft der Deployment-Pipeline, nicht der
Repository-Aufteilung.

## Entscheidung

Alle Bestandteile der Plattform liegen in **einem Repository** (Monorepo), verwaltet mit
**pnpm Workspaces**.

Verzeichnisstruktur:

```
/
├─ .github/workflows/     CI-Pipelines
├─ docs/                  Dokumentation, ADRs, OpenAPI-Contracts
├─ infra/                 Infrastruktur (lokal, später Kubernetes/GitOps)
├─ services/<name>/       je ein Verzeichnis pro Microservice
├─ packages/<name>/       geteilte Pakete (generierte API-Clients u. Ä.)
└─ frontend/              Next.js-Anwendung
```

Verbindliche Regeln:

1. **Kein Service importiert Code aus einem anderen Service.** Kommunikation
   ausschließlich über die veröffentlichte API des jeweils anderen Service.
2. **Kein Service greift auf die Datenbank eines anderen Service zu.** Siehe
   [ADR-0003](0003-datenbank-und-datenhoheit.md).
3. Geteilter Code liegt ausschließlich unter `packages/` und wird über das
   pnpm-Workspace-Protokoll referenziert (`"workspace:*"`), nie über relative Pfade oder
   `paths`-Aliase.
4. Jeder Service besitzt ein eigenes Container-Image und eine eigene Deployment-Einheit.

## Begründung

**Atomare Änderungen über Contract-Grenzen hinweg.** Ändert sich ein OpenAPI-Contract,
liegen Spezifikation, Server und generierter Client in einem Commit. In getrennten
Repositories wären dafür koordinierte Pull Requests nötig, deren Reihenfolge niemand
erzwingt.

**Eine CI-Konfiguration.** Unabhängiges Deployment wird über Pfadfilter in der Pipeline
erreicht: Nur Services, deren Verzeichnis sich geändert hat, werden gebaut und
ausgerollt. Damit ist §14 erfüllt, ohne die Pipeline zu vervielfachen.

**Angemessen für die Teamgröße.** Der Hauptvorteil getrennter Repositories – unabhängige
Freigabe- und Zugriffsrechte zwischen Teams – hat bei einer umsetzenden Person keinen
Wert, während die Kosten sofort anfallen.

**Der Servicegrenzen-Schnitt entsteht trotzdem ab Tag eins.** Die oben genannten Regeln 1
und 2 sind das, was einen Microservice ausmacht – nicht die Repository-Grenze. Siehe
[ADR-0007](0007-inkrementeller-aufbau-der-servicelandschaft.md).

## Betrachtete Alternativen

### Ein Repository je Service (Polyrepo)

Maximale Entkopplung, getrennte Zugriffsrechte, unabhängige Release-Zyklen.

Nicht gewählt, weil der Verwaltungsaufwand (mehrere Pipelines, Versions-Abstimmung
zwischen Repositories, koordinierte Contract-Änderungen) den Nutzen bei dieser
Projektgröße deutlich übersteigt. Ein späterer Wechsel bleibt möglich: Da jeder Service
in einem eigenen Verzeichnis ohne Cross-Imports liegt, lässt er sich mit
`git subtree split` unter Erhalt der Historie herauslösen.

## Konsequenzen

### Positiv

- Ein `pnpm install`, ein Lockfile, ein Lint- und Formatierungsstand für alle Teile.
- Contract-Änderung und Client-Anpassung sind nachweislich im selben Commit.
- Refactorings über Paketgrenzen hinweg sind in einem Schritt möglich.

### Negativ und Risiken

- **Die Servicegrenze ist nicht technisch erzwungen.** Ein versehentlicher relativer
  Import zwischen zwei Services würde übersetzen. Gegenmaßnahme: eine Lint-Regel
  (`noRestrictedImports`) in der CI, sobald der zweite Service existiert; alternativ
  TypeScript Project References, die den Verstoß zum Übersetzungsfehler machen.
- **Die CI-Laufzeit wächst mit dem Repository**, wenn keine Pfadfilter gesetzt sind.
  Gegenmaßnahme: Pfadfilter ab der ersten Pipeline (M0, Schritt 3).
- **Ein einzelnes Repository ist ein einzelner Berechtigungsbereich.** Wer schreiben
  darf, darf überall schreiben. Bei wachsendem Team über `CODEOWNERS` nachzuziehen.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Erzwingung der Import-Grenze: Lint-Regel oder Project References | Sobald der zweite Service existiert |
| Pfadfilter und Build-Matrix in der CI | M0, Schritt 3 |
| `CODEOWNERS`, falls das Team wächst | Bei Bedarf |
