# ADR-0009: ORM und Migrationswerkzeug

- **Status:** Angenommen
- **Datum:** 2026-08-05
- **Betrifft:** CLAUDE.md §2, §6, §10, §16
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

[ADR-0003](0003-datenbank-und-datenhoheit.md) legt PostgreSQL fest und vertagt die Wahl
des ORM auf Meilenstein M1. Prisma ist dort bereits ausgeschlossen (schwache
JSONB-Typisierung, keine sauberen Abfragen auf JSON-Pfaden).

Die Anforderungen, an denen sich die Wahl entscheidet:

- **§6 – dynamisches Attributmodell.** JSONB-Spalte mit GIN-Index, Abfragen auf
  JSON-Pfaden, Validierung gegen zur Laufzeit geladene Definitionen. Der SQL, der dabei
  entsteht, muss lesbar und gezielt optimierbar sein.
- **§16 – Historisierung.** Jede Schreiboperation wird mit altem und neuem Wert
  auditiert, einschließlich Herkunft.
- **§10 – Reporting.** Verknüpfungen und Aggregationen über die Fachdaten.
- **§2 – Clean Architecture.** Der Datenzugriff bleibt eine austauschbare Schicht.

## Entscheidung

**Drizzle ORM** mit **drizzle-kit** für Migrationen, Treiber `pg` (node-postgres).

Ergänzend gilt:

1. **Migrationen werden erzeugt, aber gelesen.** `drizzle-kit generate` leitet die
   SQL-Datei aus dem Schema ab; sie wird vor dem Commit geprüft und nicht ungesehen
   übernommen.
2. **Der Audit-Eintrag wird explizit geschrieben**, in derselben Transaktion wie die
   fachliche Änderung – nicht als Nebeneffekt eines ORM-Mechanismus. Begründung unten.
3. **Datenbankzeilen verlassen die Repository-Schicht nicht.** Controller und API
   arbeiten mit eigenen Typen; die Zuordnung erfolgt in der Service-Schicht.

## Begründung

**Der erzeugte SQL ist vorhersagbar.** Drizzle ist ein typsicherer Abfragegenerator, kein
Data-Mapper mit Unit of Work. Was geschrieben wird, entspricht dem, was ausgeführt wird.
Bei JSONB-Abfragen mit GIN-Indizes ist das keine Stilfrage: Ob ein Index greift, hängt am
konkreten Operator, und eine Abstraktionsschicht, die den Operator wählt, macht
Performance-Probleme schwer auffindbar.

**Der Fluchtweg ist erstklassig.** Für JSON-Pfad-Abfragen, die kein
Abfragegenerator sinnvoll abbildet, gibt es das `sql`-Template – eingebettet in dieselbe
Typprüfung, ohne den Datenzugriff zu verlassen.

**Das Schema ist gewöhnlicher TypeScript-Code.** Keine Decorators, keine Metadaten zur
Laufzeit, keine zusätzliche Transformationsstufe. Das passt zu einem Modell, in dem
Definitionen ohnehin als Daten behandelt werden (§6), und es erspart eine weitere
Abhängigkeit von `emitDecoratorMetadata`, das uns in
[ADR-0008](0008-teststrategie-und-testinfrastruktur.md) bereits beschäftigt hat.

**Weniger Konzepte.** Kein Identity Map, kein Flush-Zeitpunkt, keine Lazy-Loading-Fallen.
Bei einer Person, die den gesamten Code schreibt, ist die Zahl der Mechanismen, die man
gleichzeitig im Kopf halten muss, ein echter Faktor.

## Betrachtete Alternativen

### MikroORM

Ernsthafter Kandidat mit einem konkreten Vorteil: Unit of Work und Change Tracking
kennen den Ursprungszustand einer Entität. Ein `onFlush`-Abonnent könnte die
Historisierung aus §16 damit zentral und fast beiläufig erzeugen.

Nicht gewählt – und zwar **genau wegen dieses Vorteils**. Ein Auditpfad, der als
Nebeneffekt der ORM-Interna entsteht, hat eine gefährliche Eigenschaft: Er greift nicht
mehr, sobald jemand am ORM vorbei arbeitet – Massenoperationen, rohes SQL, Migrationen.
Der Ausfall ist dabei **still**: Die fachliche Änderung gelingt, nur der Nachweis fehlt.

§16 und §5 verlangen einen Auditpfad als Compliance-Nachweis. Ein solcher Nachweis muss
sichtbar, testbar und vom eingesetzten Datenzugriffswerkzeug unabhängig sein. Schreiben
wir ihn ohnehin ausdrücklich, entfällt der wesentliche Vorteil von MikroORM, während
seine Kosten – mehr Konzepte, mehr Magie, Decorators mit Laufzeit-Metadaten – bleiben.

Hinzu kommt: Für die JSONB-lastigen Abfragen aus §6 landet man auch mit MikroORM
regelmäßig bei rohem SQL. Dann lieber ein Werkzeug, das dafür gebaut ist.

### Reines SQL mit einer Abfragebibliothek

Maximale Kontrolle, keine Abstraktion.

Nicht gewählt: Migrationen, Typableitung aus dem Schema und Zuordnung der Ergebnisse
müssten selbst gebaut werden. Drizzle liefert genau diese drei Dinge und lässt den SQL
im Übrigen unangetastet.

## Konsequenzen

### Positiv

- Der ausgeführte SQL ist aus dem Code ablesbar; Indexnutzung ist gezielt prüfbar.
- Schema und Typen haben eine gemeinsame Quelle, ohne Codegenerierung zur Bauzeit.
- Kein zusätzlicher Decorator-Mechanismus neben dem von NestJS.

### Negativ und Risiken

- **Kein Change Tracking.** Für die Historisierung muss der Vorzustand ausdrücklich
  gelesen werden. Mehr Code – dafür sichtbarer und prüfbarer. Der Audit-Schreibpfad wird
  in M1.4 festgelegt und ist ab dann Pflichtbestandteil jeder Schreiboperation.
- **Beziehungen sind ausdrücklich.** Was bei einem Data-Mapper automatisch nachgeladen
  würde, wird hier als Verknüpfung geschrieben. Beabsichtigt: Es gibt kein
  N+1-Problem, das man nicht sieht.
- **Erzeugte Migrationen brauchen Aufmerksamkeit.** `drizzle-kit generate` leitet aus dem
  Schema-Unterschied ab und kann bei Umbenennungen `DROP`/`ADD` statt `RENAME` erzeugen –
  mit Datenverlust. Deshalb Regel 1: Migrationen werden gelesen, bevor sie committet
  werden.
- **Kleineres Ökosystem als bei den etablierten ORMs.** Für Standardfälle ausreichend;
  bei exotischen Anforderungen ist mehr Eigenbau zu erwarten.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Audit-Ereignisschema und Schreibpfad | M1.4, vor der ersten Schreiboperation |
| Historisierungsverfahren: Journal-Tabelle oder temporale Tabellen | M1.4 |
| Optimistische Sperre über die Spalte `version` | M1.4, mit der ersten Änderung |
| Trennung von Migrations- und Laufzeitrolle (`PROD-021`) | vor der ersten produktionsnahen Umgebung |
| Abbildung der Attributdefinitionen aus §6 | M3 |

## Nachweise

Geprüfte Fassungen zum Entscheidungszeitpunkt: `drizzle-orm@0.45.2`,
`drizzle-kit@0.31.10`, `pg@8.22.0`, `@testcontainers/postgresql@12.1.0`.
