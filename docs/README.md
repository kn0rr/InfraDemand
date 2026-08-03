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
| [`api/`](api/) | Versionierte OpenAPI-Contracts je Service (ab Meilenstein M1) |

## Einstiegspunkte

- **Neu im Projekt?** → [`development/installation.md`](development/installation.md)
- **Verstehen, wie das System aufgebaut ist?** → [`architecture/README.md`](architecture/README.md)
- **Wissen, warum eine Technologie gewählt wurde?** → [`adr/README.md`](adr/README.md)
- **Welche Werkzeuge sind im Einsatz?** → [`development/tooling.md`](development/tooling.md)

## Grundsatz

Dokumentation ist Bestandteil der Entwicklung (CLAUDE.md, Abschnitt 2), nicht deren
Nachbereitung. Konkret:

- Eine Entscheidung mit struktureller Wirkung wird als ADR festgehalten, **bevor** sie
  umgesetzt wird.
- Ändert eine Implementierung das Verhalten einer Schnittstelle, wird der
  OpenAPI-Contract im selben Commit angepasst.
- Wird ein Werkzeug hinzugefügt oder eine Version angehoben, wird
  [`development/tooling.md`](development/tooling.md) im selben Commit aktualisiert.

## Stand

Das Projekt befindet sich in Meilenstein **M0 (Fundament)**. Der aktuelle Stand und die
geplante Reihenfolge stehen in
[`architecture/README.md`](architecture/README.md#umsetzungsstrategie).
