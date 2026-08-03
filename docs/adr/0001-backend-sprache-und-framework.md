# ADR-0001: Backend-Sprache und Framework

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §2, §3, §4, §7, §9, §16
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

CLAUDE.md legt den Frontend-Stack fest (TypeScript, React, Next.js, §3) und fordert eine
Microservice-Architektur (§4), nennt für das Backend aber keine Sprache. Gleichzeitig
setzen einzelne Abschnitte implizit Ökosysteme voraus:

- §9 nennt Prophet und statsmodels für Forecasting – beide sind Python-Bibliotheken.
- §7 nennt `json-rules-engine` für Workflow-Regeln – eine JavaScript-Bibliothek.

Erschwerend kommt eine organisatorische Randbedingung hinzu: Der gesamte Produktivcode
wird von einer einzelnen Person geschrieben (CLAUDE.md §0). Entwicklungsgeschwindigkeit
und geringer Boilerplate-Anteil sind damit keine Bequemlichkeit, sondern ein
Projektrisiko-Faktor.

Zum Entscheidungszeitpunkt war bereits festgelegt, dass ein Monorepo verwendet wird
([ADR-0002](0002-repository-struktur.md)).

## Entscheidung

Alle fachlichen Services werden in **TypeScript mit NestJS** implementiert
(Fastify-Adapter, nicht Express).

**Python wird ausschließlich für den Forecasting-Worker des Capacity Service
eingesetzt.** Dieser Worker ist kein eigener fachlicher Service, sondern eine hinter
einer Schnittstelle gekapselte Rechenkomponente des Capacity Service.

Andere Sprachen werden nicht eingeführt, ohne dass ein eigenes ADR dies begründet.

## Begründung

**Eine Werkzeugkette für das gesamte Monorepo.** Da das Frontend ohnehin TypeScript ist
und ein Monorepo beschlossen wurde, bedeutet ein TypeScript-Backend: ein
Paketmanager, ein Linter, ein Testrunner, eine Node-Version, ein CI-Cache, ein
Dockerfile-Muster. Bei einer Person, die alles betreibt, ist das über die Projektlaufzeit
erheblich.

**Die Sprachgrenze liegt an der selteneren Stelle.** Beide ernsthaft betrachteten Wege
enden bei zwei Sprachen, weil Forecasting realistisch Python braucht. Entscheidend ist,
wo die Grenze verläuft: zwischen Frontend und Backend (wird bei fast jedem Feature
überquert) oder innerhalb des Capacity Service an einer Worker-Schnittstelle (wird selten
überquert und ist klar gekapselt). Letzteres ist die günstigere Schnittfläche.

**NestJS-Bausteine passen auf die Querschnittsanforderungen.** Guards bilden die
Berechtigungsprüfung aus §8 ab, Interceptors die lückenlose Auditierung jeder
Schreiboperation aus §16, ohne dass beides in jedem Handler wiederholt wird. Die
Modulstruktur unterstützt den in §2 geforderten Clean-Architecture-Schnitt.

**Vorhandene Routine.** Die umsetzende Person arbeitet routinierter in TypeScript. Bei
einer Ein-Personen-Umsetzung schlägt dieser Faktor die verbleibenden technischen
Feinunterschiede.

## Betrachtete Alternativen

### Python 3.13 mit FastAPI

Ernsthafter Kandidat mit realen Vorteilen: deutlich weniger Code pro Endpunkt, natives
Forecasting-Ökosystem, und für das dynamische Attributmodell aus §6 die elegantere
Variante – zur Laufzeit aus einer Attributdefinition erzeugte Pydantic-Modelle liefern
ihr JSON Schema mit, wodurch administrativ konfigurierte Attribute ohne Redeploy in der
OpenAPI-Dokumentation erscheinen.

Nicht gewählt, weil die zweite Werkzeugkette im Monorepo dauerhaft mitgeschleppt werden
müsste, die Sprachgrenze an der häufig überquerten Frontend/Backend-Naht läge und die
Routine der umsetzenden Person in TypeScript größer ist.

### Java 21 mit Spring Boot

Der Branchenstandard für diese Domäne, mit dem reifsten Angebot bei Historisierung
(Hibernate Envers) und Prozess-Engines (Camunda/Zeebe, relevant für §7).

Nicht gewählt wegen des mit Abstand höchsten Boilerplate-Anteils und der längsten
Feedbackschleife – beides wiegt bei einer Ein-Personen-Umsetzung schwerer als der
Reifevorsprung. Forecasting bräuchte zusätzlich Python.

## Konsequenzen

### Positiv

- Eine Paketmanager-, Lint-, Test- und Build-Konfiguration für Frontend und Backend.
- Kein Kontextwechsel zwischen Frontend- und Backend-Arbeit.
- `json-rules-engine` und `xstate` (serialisierbare, als Fachdaten speicherbare
  Zustandsgraphen für §7) sind nativ verfügbar.
- Der offizielle Zeebe-Node-Client steht bereit, falls §7 später eine ausgewachsene
  Prozess-Engine erfordert.

### Negativ und Risiken

- **Forecasting braucht eine zweite Laufzeit.** Der Python-Worker erzeugt ein zusätzliches
  Container-Image, eine zweite Abhängigkeitsverwaltung und eine zusätzliche
  CI-Strecke. Das ist erst ab Meilenstein M6 relevant, aber es verschwindet nicht.
- **Mehr Boilerplate als bei FastAPI.** Bewusst in Kauf genommen.
- **Node ist single-threaded.** Die Overhead-Berechnungen aus §18 und Aggregationen für
  §10 müssen ab einer bestimmten Größe in Worker-Prozesse ausgelagert werden, sonst
  blockieren sie den Request-Pfad. Frühwarnzeichen: steigende p99-Latenz bei
  gleichbleibendem Durchsatz.
- **Die ORM-Wahl ist heikel.** Für JSONB-lastige Modelle mit Historisierung ist Prisma
  ungeeignet (schwache JSONB-Typisierung, keine sauberen Abfragen auf JSON-Pfaden).
  Siehe [ADR-0003](0003-datenbank-und-datenhoheit.md).

## Wichtige Design-Leitplanke

Ein naheliegender, aber falscher Schluss aus dieser Entscheidung wäre: „Eine Sprache,
also teilen Frontend und Backend ihre Validierungsschemata als Code."

Das widerspricht §6. Attributdefinitionen sind **Fachdaten**, kein Code – ein gemeinsam
importiertes Schema im Repository müsste bei jeder administrativen Änderung neu deployt
werden. Verbindlich gilt stattdessen:

> Der Requirement Service liefert das JSON Schema zu einem Anforderungstyp über die API
> aus. Das Frontend rendert das Formular daraus und validiert dagegen. Das Backend
> validiert dieselbe Nutzlast gegen dasselbe Schema. Der geteilte Vertrag ist das JSON
> Schema als Datum, nicht der Code.

Damit ist die in §16 geforderte identische Validierung in UI und API über den
gemeinsamen Draft-Standard garantiert, unabhängig von der Sprachwahl.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| ORM und Migrationswerkzeug | M1, [ADR-0003](0003-datenbank-und-datenhoheit.md) |
| Regel-Engine für §7: JSONLogic oder `json-rules-engine` | M4 |
| Aufteilung Requestpfad / Worker im Capacity Service | M6 |

Zur Regel-Engine bereits eine Empfehlung für die spätere Entscheidung: **JSONLogic** ist
`json-rules-engine` vermutlich vorzuziehen, weil es Implementierungen in JavaScript *und*
Python besitzt und die Regeln reines JSON sind – also als Fachdaten versionierbar. Zudem
kann das Frontend dieselbe Übergangsbedingung auswerten und einen Button deaktivieren,
statt den Nutzer in eine 403-Antwort laufen zu lassen.
