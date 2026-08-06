# Dokumentation

Diese Verzeichnisstruktur enthält die gesamte projektbegleitende Dokumentation der
Anforderungs- und Kapazitätsmanagement-Plattform.

Die fachlichen Anforderungen selbst stehen in [`../CLAUDE.md`](../CLAUDE.md) im
Repository-Wurzelverzeichnis. Dieses Dokument ist die verbindliche Anforderungsquelle;
alle Dokumente hier verweisen darauf und ersetzen es nicht.

## Wegweiser

| Verzeichnis | Inhalt |
|---|---|
| [`adr/`](adr/) | Architekturentscheidungen (Architecture Decision Records) – *warum* etwas so ist |
| [`architecture/`](architecture/) | Systemüberblick, Servicelandschaft, Querschnittsthemen – *was* gebaut wird |
| [`development/`](development/) | Installation, Werkzeugkette, Konventionen – *wie* gearbeitet wird |
| [`operations/`](operations/) | Betrieb und Produktionsreife – *was fehlt noch* |
| [`api/`](api/) | Versionierte OpenAPI-Contracts je Service (ab Meilenstein M1) |

## Einstiegspunkte

- **Neu im Projekt?** → [`development/installation.md`](development/installation.md)
- **Verstehen, wie das System aufgebaut ist?** → [`architecture/README.md`](architecture/README.md)
- **Wissen, warum eine Technologie gewählt wurde?** → [`adr/README.md`](adr/README.md)
- **Welche Werkzeuge sind im Einsatz?** → [`development/tooling.md`](development/tooling.md)
- **Was fehlt noch bis zur Produktionsreife?** → [`operations/production-readiness.md`](operations/production-readiness.md)
- **Einen neuen Service anlegen?** → [`development/service-setup.md`](development/service-setup.md)

## Grundsatz

Dokumentation ist Bestandteil der Entwicklung (CLAUDE.md, Abschnitt 2), nicht deren
Nachbereitung. Konkret:

- Eine Entscheidung mit struktureller Wirkung wird als ADR festgehalten, **bevor** sie
  umgesetzt wird.
- Ändert eine Implementierung das Verhalten einer Schnittstelle, wird der
  OpenAPI-Contract im selben Commit angepasst.
- Wird ein Werkzeug hinzugefügt oder eine Version angehoben, wird
  [`development/tooling.md`](development/tooling.md) im selben Commit aktualisiert.
- **Wird eine Entwicklungsabkürzung genommen, ein Sicherheitsmechanismus abgeschaltet
  oder ein Punkt auf „später" vertagt, wird er im selben Arbeitsschritt in
  [`operations/production-readiness.md`](operations/production-readiness.md)
  eingetragen.** Diese Regel gilt ausnahmslos und für alle Beteiligten einschließlich der
  KI in ihrer Beraterrolle: Wer eine Abkürzung vorschlägt, trägt sie dort ein.

## Stand

**M0 (Fundament)** und **M1 (Walking Skeleton Requirement Service)** sind abgeschlossen.

Der Requirement Service hat einen vollständigen vertikalen Durchstich: geschützte
Endpunkte gegen Keycloak, Persistenz mit Drizzle, vollständige Versionshistorie mit
Stichtagsabfrage nach §19.4, und einen versionierten OpenAPI-Contract mit drei Toren in
der CI.

Laufend ist **M2 (Frontend-Durchstich)**. Der Stand je Meilenstein steht in
[`architecture/README.md`](architecture/README.md#umsetzungsstrategie).
