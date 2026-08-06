# ADR-0016: UI-Grundlage Mantine und Datenzugriff über TanStack Query

- **Status:** Angenommen
- **Datum:** 2026-08-06
- **Betrifft:** CLAUDE.md §3, §6, §11, §15
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Mit M2.5 entsteht die erste fachliche Oberfläche: Anforderungen auflisten und anlegen.
Bisher besteht das Frontend aus dem Gerüst (M2.2), der Anmeldung (M2.3) und dem
Weiterleitungspfad (M2.4); eine Komponentenbibliothek gibt es nicht.

§3 nennt „Open-Source UI Framework" und „TanStack Query" als bevorzugte Bausteine, legt
sich aber nicht fest. Drei Vorgaben schränken die Wahl tatsächlich ein:

- **§6 macht Attributdefinitionen zu Fachdaten.** Welche Felder ein Formular hat, welchen
  Typ sie haben und welche Werte zulässig sind, steht in der Datenbank, nicht im Code.
  Formulare entstehen damit **zur Laufzeit aus einem Schema**. Das ist ab M3 der Regelfall,
  nicht ein Sonderfall
- **§15 fordert Barrierefreiheit nach WCAG.** Nachträglich ist sie kaum herstellbar:
  Tastaturführung, Fokusverwaltung und ARIA-Rollen stecken in den Bausteinen selbst
- **§11 fordert konfigurierbare Dashboards** mit rollenabhängiger Sichtbarkeit

Hinzu kommt eine Eigenheit dieser Anwendung: Nach
[ADR-0014](0014-frontend-authentifizierung-ueber-bff.md) spricht der Browser die Services
nicht unmittelbar an, sondern über das Backend-for-Frontend. Der Datenzugriff läuft über
gewöhnliche HTTP-Aufrufe an den eigenen Ursprung – ohne Token, ohne CORS.

## Entscheidung

**1. Mantine ist die Komponentengrundlage des Frontends.**
Verwendet werden `@mantine/core`, `@mantine/hooks` und `@mantine/form`.

**2. TanStack Query verantwortet den lesenden Datenzugriff im Browser** – Zwischenspeicher,
Neuvalidierung, Ladezustände und Fehlerzustände.

**3. Der typsichere Client aus [ADR-0005](0005-api-first-workflow.md) bleibt die einzige
Zugriffsart.** TanStack Query umschließt ihn, ersetzt ihn nicht. Kein `fetch` von Hand in
einer Komponente.

**4. Serverseitig gerendertes Laden bleibt möglich und ist nicht abgeschafft.** Wo eine
Seite ihre Daten ohne Interaktion darstellt, lädt die Server Component sie unmittelbar.
TanStack Query ist für das zuständig, was sich im Browser ändert.

**5. Barrierefreiheit wird nicht selbst gebaut.** Wo Mantine eine Komponente anbietet, wird
sie verwendet. Eine eigene Umsetzung braucht einen Grund, der über Gestaltung hinausgeht.

## Begründung

**Ausschlaggebend war §6, nicht das Aussehen.** Ein Formular, dessen Felder erst zur
Laufzeit feststehen, ist etwas anderes als ein Formular mit festen Feldern: Der
Formularzustand muss mit einer veränderlichen Feldmenge umgehen, Validierungsregeln kommen
aus Daten statt aus Typen, und Feldgruppen können verschachtelt sein. `@mantine/form` bildet
das ohne Umweg ab und ist Bestandteil derselben Bibliothek – Formularzustand und
Eingabekomponenten stammen nicht von zwei Anbietern mit zwei Vorstellungen von
kontrollierten Eingaben.

**Der Umfang deckt ab, was §10 und §11 später verlangen.** Tabelle, Datumsauswahl,
Benachrichtigungen und Modaldialoge sind vorhanden. Jede davon selbst zu bauen, wäre
Aufwand ohne fachlichen Ertrag – und jede davon barrierefrei zu bauen, wäre erheblicher
Aufwand ohne fachlichen Ertrag.

**Die Lizenz ist vollständig MIT.** Es gibt keine Fassung, deren leistungsfähige
Bestandteile kostenpflichtig sind. Das ist bei einer Plattform mit der harten Vorgabe
„ausschließlich Open Source" kein Nebenpunkt: Eine Bibliothek, deren Tabelle erst in der
kostenpflichtigen Ausgabe brauchbar ist, verschiebt das Problem nur nach hinten.

**TanStack Query löst ein Problem, das sonst verstreut gelöst würde.** Ladezustand,
Fehlerzustand, Neuvalidierung nach dem Schreiben und Vermeidung doppelter Abrufe entstehen
in jeder Anwendung – entweder einmal an einer Stelle oder verteilt in jeder Komponente.

## Betrachtete Alternativen

### Radix-Primitive mit eigenem Styling (shadcn-Muster)

Unformatierte, barrierefreie Primitive; die Komponenten liegen als eigener Code im
Repository.

Vorteile: vollständige Kontrolle über Gestaltung und Verhalten, keine Bindung an eine
fremde Gestaltungssprache, keine große Abhängigkeit.

**Nicht gewählt**, weil Tabelle, Formularzustand und Validierung dann selbst entstehen –
und zwar in genau dem Bereich, der nach §6 der anspruchsvollste ist. Der Vorteil,
Gestaltung zu beherrschen, wiegt hier weniger als der Nachteil, die schwierigen Teile
selbst zu verantworten. Bleibt die richtige Wahl, wenn ein verbindliches eigenes
Gestaltungssystem hinzukommt; dann ist ein neues ADR fällig.

### MUI

Größtes Ökosystem, sehr ausgereift, im Kern MIT.

**Nicht gewählt**, weil die leistungsfähige Data-Grid-Variante kostenpflichtig ist. Für
eine Plattform, deren Kernanforderung „ausschließlich Open-Source-Software, keine Ausnahmen
für Kernkomponenten" lautet, ist eine Bibliothek unpassend, deren naheliegender Weg für
Datenlisten in ein kommerzielles Angebot führt. Dass der freie Teil ausreichen *könnte*,
ändert daran nichts – die Entscheidung fällt sonst später unter Zeitdruck.

### Ohne Bibliothek, nur eigene Komponenten

**Nicht gewählt.** §15 fordert WCAG. Zugängliche Auswahlfelder, Dialoge und
Tastaturführung selbst zu bauen ist ein eigenes Vorhaben, und das Ergebnis wäre schlechter.

## Konsequenzen

### Positiv

- Formulare, Tabellen und Dialoge sind ab sofort verfügbar, ohne Eigenentwicklung
- Barrierefreiheit hat eine belastbare Grundlage statt einer Absichtserklärung
- Der Datenzugriff hat genau eine Form: erzeugter Client, umschlossen von TanStack Query
- Das dunkle Farbschema und die Gestaltungsmarken sind zentral gesetzt, nicht je Seite

### Negativ

- **Eine große Abhängigkeit mit eigener Gestaltungssprache.** Ein späterer Wechsel beträfe
  jede Komponente. Das ist der Preis der Entscheidung und der Grund für dieses ADR
- **Mantine-Komponenten sind Client Components.** Jede Seite, die sie verwendet, verlässt
  das reine serverseitige Rendern. Punkt 4 hält fest, dass das eine Wahl je Seite bleibt
  und nicht pauschal gilt
- Zwei Zustandsbegriffe im Frontend: Formularzustand (`@mantine/form`) und Serverzustand
  (TanStack Query). Die Grenze ist klar, muss aber eingehalten werden – Serverdaten gehören
  nicht in den Formularzustand kopiert, außer als Anfangswert

### Offen

- Ob Diagramme aus §11 mit Recharts oder ECharts entstehen, ist **nicht entschieden** und
  wird mit dem ersten Dashboard nachgezogen
- Ein eigenes Gestaltungssystem (Farben, Abstände, Typografie über die Voreinstellung
  hinaus) ist noch nicht festgelegt
