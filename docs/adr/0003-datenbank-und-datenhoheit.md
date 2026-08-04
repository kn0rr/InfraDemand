# ADR-0003: Datenbank und Datenhoheit je Service

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §4, §6, §9, §13
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§6 beschreibt das dynamische Anforderungsmodell mit „strukturierten Werten (z. B. JSONB)"
am Objekt und Laufzeitvalidierung gegen JSON Schema. Damit ist eine relationale Datenbank
mit erstklassiger JSON-Unterstützung faktisch vorgezeichnet.

§4 fordert eigene Datenhaltung je Service, sofern sinnvoll. §9 fordert historische
Verbrauchsdaten als Zeitreihen. §13 fordert Verschlüsselung im Ruhezustand.

Zusätzlich gilt die harte Vorgabe aus §1: ausschließlich Open-Source-Software.

## Entscheidung

**PostgreSQL** ist das Datenbanksystem für alle Services. Lokal in der Entwicklung wird
PostgreSQL 18 (Alpine-Image) verwendet.

**Je Service eine eigene Datenbank mit einer eigenen Rolle.** Lokal laufen diese
Datenbanken in einer gemeinsamen Instanz, in produktionsnahen Umgebungen können es
getrennte Instanzen oder Cluster sein. Die Regel ist in beiden Fällen dieselbe:

> Ein Service verbindet sich ausschließlich mit seiner eigenen Datenbank und mit seiner
> eigenen Rolle. Ein serviceübergreifender Datenbankzugriff – lesend wie schreibend – ist
> unzulässig. Daten anderer Services werden über deren API bezogen.

Die Rollentrennung gilt **auch in der lokalen Entwicklungsumgebung**. Ein gemeinsam
genutzter Superuser wäre bequemer und würde die Grenze genau dort aufweichen, wo sie
verletzt wird.

Auch Keycloak erhält nach dieser Regel eine eigene Datenbank und Rolle.

**Nicht Teil dieser Entscheidung** ist die Wahl des ORM und des Migrationswerkzeugs.
Diese wird in Meilenstein M1 als eigenes ADR getroffen.

## Begründung

**JSONB ist die tragende Fähigkeit für §6.** PostgreSQL bietet JSONB mit
GIN-Indizierung, JSON-Path-Abfragen (SQL/JSON) und Constraint-Prüfungen. Das dynamische
Attributmodell ist damit ohne Fremdsystem abbildbar, und die Attributdefinitionen selbst
sind normale relationale Fachdaten.

**Ein System deckt mehrere Anforderungen ab.** Historisierung (§6), Volltextsuche für
Kommentare (§5), und über die TimescaleDB-Erweiterung auch die Zeitreihen aus §9 – ohne
ein zweites Datenbanksystem einzuführen. Ob TimescaleDB tatsächlich benötigt wird,
entscheidet sich erst im Capacity Service; die Option bleibt offen, ohne heute Kosten zu
verursachen.

**Lizenz.** Die PostgreSQL-Lizenz ist eine permissive Open-Source-Lizenz und erfüllt §1
ohne Einschränkung, auch für kommerzielle Nutzung.

**Getrennte Rollen machen die Servicegrenze überprüfbar.** Verletzt ein Service die
Grenze, scheitert er an einem Berechtigungsfehler statt still falsche Daten zu lesen.
Das verwandelt einen Architekturverstoß in einen sofort sichtbaren Laufzeitfehler.

## Betrachtete Alternativen

### MongoDB oder ein anderes Dokumentenmodell

Auf den ersten Blick naheliegend für dynamische Attribute.

Nicht gewählt, weil die Kernentitäten aus §6 ausdrücklich stabil und relational sind
(`project_id`, `owner`, `status`, Fremdschlüssel zu Projekten und Kategorien) und weil
§10, §17 und §18 Auswertungen mit Verknüpfungen und Aggregationen über diese Beziehungen
verlangen. Die dynamischen Anteile sind der kleinere Teil des Modells – ein rein
dokumentenorientierter Ansatz würde den größeren Teil verschlechtern. Hinzu kommt die
Lizenzlage (SSPL), die mit der Vorgabe aus §1 nicht sauber vereinbar ist.

### Eine gemeinsame Datenbank für alle Services

Deutlich einfacher zu betreiben, erlaubt serviceübergreifende Transaktionen und
Verknüpfungen.

Nicht gewählt, weil sie §4 direkt widerspricht und die teuerste aller späteren
Entkopplungen erzwingen würde. Wer erst gemeinsame Tabellen verknüpft, baut die Kopplung
in die Abfragen ein, wo sie unsichtbar ist.

## Konsequenzen

### Positiv

- Ein Datenbanksystem für die gesamte Plattform, ein Betriebs- und Sicherungskonzept.
- Servicegrenzen sind durch Datenbankberechtigungen technisch durchgesetzt, nicht nur
  vereinbart.
- Die lokale Umgebung bildet die produktive Rechtestruktur nach.

### Negativ und Risiken

- **Keine serviceübergreifenden Transaktionen.** Fachliche Abläufe über Servicegrenzen
  hinweg brauchen Kompensationslogik oder ereignisgetriebene Konsistenz. Betrifft
  insbesondere §18 (Bestellung → Kapazitätsprüfung → Reservierung).
- **Keine serviceübergreifenden Verknüpfungen im Reporting.** §10 fordert ohnehin ein
  eigenes Lesemodell; dieses wird aus API- oder Ereignisdaten gespeist, nicht aus
  Fremdtabellen.
- **Verschlüsselung im Ruhezustand (§13) ist noch nicht umgesetzt.** Lokal bewusst nicht;
  für produktionsnahe Umgebungen offen und nachzuziehen.
- **Die lokalen Zugangsdaten stehen im Klartext im Repository.** Sie sind trivial, gelten
  ausschließlich lokal und dürfen niemals in eine andere Umgebung übernommen werden. Für
  alle anderen Umgebungen gilt §13: HashiCorp Vault.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| ORM: Drizzle oder MikroORM – **nicht Prisma** | M1, eigenes ADR |
| Migrationswerkzeug (hängt am ORM) | M1, dasselbe ADR |
| Historisierungsverfahren für §6 (Journal-Tabellen vs. temporale Tabellen) | M1 |
| TimescaleDB für die Zeitreihen aus §9 | M6 |
| Verschlüsselung im Ruhezustand, Sicherungs- und Wiederherstellungskonzept | Vor der ersten produktionsnahen Umgebung |

Zur ORM-Vorentscheidung: **Prisma ist ausgeschlossen.** Für ein Modell mit JSONB,
dynamischen Attributen, Historisierung und Abfragen auf JSON-Pfaden ist die Unterstützung
zu schwach; das Datenzugriffs-Layer müsste teilweise daran vorbeigebaut werden.

## Nachweise

- Verwendetes Image lokal: `postgres:18-alpine`, laufende Version PostgreSQL 18.4.
- Die Datenbanken `keycloak` und `requirement` werden mit eigenen Rollen über
  `infra/local/postgres/init/01-databases.sql` bei der Erstinitialisierung angelegt.
