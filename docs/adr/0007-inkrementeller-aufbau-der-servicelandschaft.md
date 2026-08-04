# ADR-0007: Inkrementeller Aufbau der Servicelandschaft

- **Status:** Angenommen
- **Datum:** 2026-07-31
- **Betrifft:** CLAUDE.md §0, §2, §4, §5, §14
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

§4 und §5 legen eine Microservice-Architektur mit fünf fachlichen Services fest: Identity
& Access, Requirement, Capacity, Infrastructure und Audit.

§0 legt fest, dass der gesamte Produktivcode von einer einzelnen Person geschrieben wird.

Zwischen beidem besteht eine reale Spannung. Fünf Services bedeuten fünf Deployments,
fünf Datenbanken, fünf Contracts, verteilte Konsistenz, mTLS zwischen Diensten und
Service Accounts – vollständig aufzubauen, **bevor** die erste Anforderung im System
erfasst werden kann. Wird diese Spannung nicht bewusst aufgelöst, führt sie zu einem von
zwei schlechten Ergebnissen: entweder monatelanger Infrastrukturaufbau ohne fachlichen
Fortschritt, oder ein stillschweigend gebauter Monolith, dessen Aufteilung nie erfolgt.

## Entscheidung

Die Servicegrenzen gelten **ab dem ersten Commit vollständig**. Die Services werden
**nacheinander** gebaut, nicht gleichzeitig.

Konkret:

1. **Jeder Service, der existiert, ist ein vollwertiger Service.** Eigenes Verzeichnis
   unter `services/`, eigene Datenbank und Datenbankrolle
   ([ADR-0003](0003-datenbank-und-datenhoheit.md)), eigener OpenAPI-Contract
   ([ADR-0005](0005-api-first-workflow.md)), eigenes Container-Image, eigene
   Deployment-Einheit. Kein Code- und kein Datenbankzugriff über Servicegrenzen hinweg
   ([ADR-0002](0002-repository-struktur.md)).
2. **Ein Service wird erst angelegt, wenn eine fachliche Anforderung ihn benötigt** – und
   nicht, weil er in §5 aufgeführt ist.
3. **Kein modularer Monolith mit geplanter späterer Aufteilung.** Die Grenzen sind von
   Anfang an echt; es gibt zunächst nur weniger davon.
4. Bis ein Service existiert, wird seine Verantwortung **nicht ersatzweise** in einem
   anderen Service untergebracht. Wird eine Fähigkeit vorher gebraucht, wird der
   zugehörige Service gebaut.

Reihenfolge, mit Begründung je Schritt:

| Meilenstein | Service | Warum an dieser Stelle |
|---|---|---|
| M1 | Requirement Service | Fachlicher Kern. Erzwingt alle Querschnittsentscheidungen einmal an einem echten Beispiel. |
| M2 | *(kein neuer Service)* | Frontend-Durchstich gegen M1 – beweist, dass der Contract trägt. |
| M3 | *(kein neuer Service)* | Dynamisches Attributmodell (§6) im Requirement Service. |
| M4 | *(kein neuer Service)* | Workflow-Engine (§7) im Requirement Service. |
| M5 | Identity & Access Service | Sobald das Berechtigungsmodell (§8) über Keycloak-Rollen hinausgeht. |
| M6 | Infrastructure Service | Voraussetzung für Bestellungen und Kapazitätspools (§17, §18). |
| M7 | Capacity Service | Braucht Infrastructure-Stammdaten und historische Daten (§9, §18). |
| M8 | Audit Service | Bis dahin schreibt jeder Service seine Audit-Einträge lokal nach einheitlichem Schema; die Herauslösung ist dadurch ein Umzug, kein Neubau. |

## Begründung

**Der Walking Skeleton entwertet die Querschnittsrisiken einmalig.** Migrationen,
Integrationstests gegen eine echte Datenbank, Token-Validierung, Audit-Schreibpfad,
Container-Build und CI werden an einem Service gelöst. Bei fünf parallel begonnenen
Services würde jede dieser Fragen fünfmal – und wahrscheinlich fünfmal unterschiedlich –
beantwortet.

**Keycloak macht den Identity Service zunächst entbehrlich.** Authentifizierung,
Benutzerverwaltung und Service Accounts liefert Keycloak ab M0
([ADR-0004](0004-authentifizierung-und-autorisierung.md)). Der eigene Identity & Access
Service wird erst gebraucht, wenn Berechtigungen über das hinausgehen, was Rollen im
Token abbilden. Ihn vorher zu bauen hieße, eine Fassade ohne Inhalt zu betreiben.

**Der Audit Service ist bewusst der letzte.** Auditierung darf jedoch **nicht** der letzte
Schritt sein. §16 verlangt sie ab der ersten Schreiboperation. Aufgelöst wird das über
ein von Beginn an einheitliches Audit-Ereignisschema, das jeder Service zunächst in seine
eigene Datenbank schreibt. Die spätere Herauslösung überträgt dann Daten und
Schreibpfad, statt das Konzept nachträglich zu erfinden.

**Echte Grenzen statt späterer Aufteilung.** Die Erfahrung mit „erst Monolith, später
aufteilen" ist, dass die Aufteilung nicht stattfindet, weil sich unbemerkt Kopplungen
über gemeinsame Tabellen und direkte Aufrufe bilden. Getrennte Datenbankrollen und
fehlende Cross-Imports verhindern das ab dem ersten Tag – zu Kosten, die nahe null
liegen, solange es nur einen Service gibt.

## Betrachtete Alternativen

### Alle fünf Services parallel aufsetzen

Entspricht §5 am unmittelbarsten.

Nicht gewählt: Der fachliche Fortschritt käme erst nach dem vollständigen
Infrastrukturaufbau, jede Querschnittsfrage würde mehrfach beantwortet, und Änderungen an
gemeinsamen Mustern müssten fünffach nachgezogen werden – ohne dass ein einziger davon
fachlich erprobt wäre.

### Modularer Monolith mit späterer Aufteilung

Deutlich schnellerer Start, weniger Betriebsaufwand.

Nicht gewählt, weil er §4 widerspricht und die Aufteilung erfahrungsgemäß unterbleibt.
Der gewählte Weg erreicht denselben Geschwindigkeitsvorteil (nur ein laufender Service),
ohne die Grenze aufzuweichen.

## Konsequenzen

### Positiv

- Fachlicher Fortschritt ab M1 statt nach abgeschlossenem Infrastrukturaufbau.
- Querschnittsmuster werden einmal an einem echten Fall erprobt, bevor sie sich
  vervielfältigen.
- Betriebskomplexität entsteht dann, wenn sie fachlich gerechtfertigt ist.
- Die Architektur aus §4 und §5 bleibt vollständig erreichbar, ohne Umbau.

### Negativ und Risiken

- **Der Requirement Service kann zum Sammelbecken werden.** Wenn Verantwortung, die
  fachlich woandershin gehört, „vorläufig" dort landet, entsteht genau der Monolith, den
  diese Entscheidung vermeiden soll. Gegenmaßnahme: Regel 4. Frühwarnzeichen: Entitäten
  im Requirement Service, die in §5 einem anderen Service zugeordnet sind.
- **Muster, die an einem Service entstehen, sind noch nicht als übertragbar erwiesen.**
  Beim Aufbau des zweiten Service ist mit Nacharbeit am ersten zu rechnen. Das ist
  eingeplant und kein Fehlschlag.
- **Serviceübergreifende Belange werden spät sichtbar** – verteilte Ablaufverfolgung,
  Ausfallverhalten bei nicht erreichbaren Diensten, Datenkonsistenz über Grenzen.
  Gegenmaßnahme: OpenTelemetry ab M1, auch wenn es zunächst nur einen Dienst gibt.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Einheitliches Audit-Ereignisschema | M1, vor der ersten Schreiboperation |
| Erzwingung der Import-Grenze in der CI | Sobald der zweite Service existiert |
| Messaging zwischen Services (§12) | Sobald der zweite Service existiert |
| Verfahren zur Herauslösung des Audit Service | M8 |
