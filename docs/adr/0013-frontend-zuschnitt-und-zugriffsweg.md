# ADR-0013: Frontend-Zuschnitt und Zugriffsweg

- **Status:** Angenommen, **Punkt 2 ersetzt**
- **Datum:** 2026-08-05
- **Betrifft:** CLAUDE.md §3, §4, §8, §10, §11, §13
- **Ersetzt:** –
- **Ersetzt durch:** [ADR-0014](0014-frontend-authentifizierung-ueber-bff.md) – **nur Punkt 2**

> **Teilweise ersetzt am 2026-08-06.** Punkt 2 dieser Entscheidung – „Der Browser spricht
> die Service-APIs direkt an" – gilt **nicht mehr**. Browser-Aufrufe laufen über ein
> Backend-for-Frontend in Next.js
> ([ADR-0014](0014-frontend-authentifizierung-ueber-bff.md)).
>
> Grund: Die hier gegebene Begründung – eine vorgelagerte Schicht sei „eine weitere
> Komponente, die gebaut, betrieben, abgesichert und hochverfügbar gehalten werden muss" –
> traf nicht zu. Next.js ist ein Server und wird ohnehin ausgeliefert.
>
> **Unverändert gültig bleiben** Punkt 1 (ein Frontend, keine Micro-Frontends), Punkt 3
> (eigene Zielgruppe je Service) und Punkt 4 (Trennung von Bedienung und Auswertung).
> Ebenso die Entscheidung gegen ein allgemeines Gateway für den Maschinenverkehr: Externe
> Konsumenten nach §12 sprechen die Services weiterhin unmittelbar an.

## Kontext

Das Architekturdiagramm zeigte bis 2026-08-05 einen Zugriff des Frontends ausschließlich
auf den Requirement Service. Das war ein Überbleibsel aus Meilenstein M0 und warf beim
Lesen die berechtigte Frage auf, wie Prognosen dargestellt und Stammdaten der übrigen
Services gepflegt werden.

Zu klären sind drei Fragen:

1. Ein Frontend für alle Services oder eines je Service?
2. Greift der Browser direkt auf die Service-APIs zu oder über eine vorgelagerte Schicht?
3. Wo entsteht die Visualisierung aus §11 – im eigenen Frontend oder in
   Auswertungswerkzeugen?

## Entscheidung

**1. Ein Frontend für alle fachlichen Services.**
Eine Next.js-Anwendung mit fachlichen Bereichen, keine Micro-Frontends. §3 fordert eine
komponentenbasierte Architektur mit wiederverwendbaren UI-Komponenten – das beschreibt
eine Anwendung, nicht mehrere.

**2. Der Browser spricht die Service-APIs direkt an.**
Kein API-Gateway und kein Backend-for-Frontend zum jetzigen Zeitpunkt.

**3. Je Service eine eigene Zielgruppe.**
`requirement-api`, `capacity-api`, `infrastructure-api` und so weiter. Der
Frontend-Client im Realm erhält je Service, den er aufruft, einen Audience-Mapper. Ein
Token trägt damit mehrere Zielgruppen, und jeder Service prüft weiterhin ausschließlich
auf die eigene.

**4. Bedienung und Auswertung sind getrennt.**

| Zweck | Wo |
|---|---|
| Daten erfassen und ändern, Stammdaten pflegen, Bestellungen, Szenarien parametrieren | Next.js-Frontend gegen die Service-APIs |
| Fachliche Widgets und Statusübersichten | Next.js-Frontend, Daten aus den Service-APIs |
| Auswertungen, Prognosekurven, Durchlaufzeiten, Ad-hoc-Berichte | Superset oder vergleichbar, gegen das **Lesemodell** aus §10 |
| Technische Infrastrukturmetriken | Grafana gegen Prometheus, getrennt von der Fachsicht |

Auswertungswerkzeuge greifen **nicht** auf die Fachdatenbanken der Services zu. Ihre
Datenquelle ist ausschließlich das Lesemodell aus §10 – andernfalls wäre die Datenhoheit
aus [ADR-0003](0003-datenbank-und-datenhoheit.md) umgangen und jede Schemaänderung eines
Service bräche Berichte.

## Begründung

**Zu 1.** Micro-Frontends lösen ein organisatorisches Problem – unabhängig
veröffentlichende Teams. Das existiert hier nicht, die Kosten schon: eigenständige
Auslieferung, geteilte Gestaltungsbausteine, Zusammenführung zur Laufzeit.

**Zu 2 – warum kein Gateway.** Ein Gateway wäre architektonisch sauberer: eine
Ursprungsadresse, zentrale Token-Behandlung, interne Dienste nicht öffentlich erreichbar.
Es ist aber eine weitere Komponente, die gebaut, betrieben, abgesichert und
hochverfügbar gehalten werden muss – und sie wird zum Engpass für jede neue Schnittstelle.

Der Nutzen entsteht erst ab einer Zahl von Services, die wir nicht haben. Die Entscheidung
ist umkehrbar: Ein später eingeführtes Gateway ändert die Adresse, gegen die das Frontend
arbeitet, nicht dessen Aufbau.

**Zu 3 – warum eigene Zielgruppen je Service.** Ein Token mit der Zielgruppe eines
Service darf bei einem anderen nicht gelten. Andernfalls könnte ein Token, das für einen
Lesezugriff auf Anforderungen ausgestellt wurde, gegen den Infrastructure Service
verwendet werden. Die Prüfung auf die eigene Zielgruppe ist bereits in M1.2 umgesetzt;
diese Entscheidung schreibt fest, dass sie je Service verschieden ist.

**Zu 4.** §10 fordert ein getrenntes Reporting-Modell und §11 unterscheidet zwischen
technischer und fachlicher Visualisierung. Ein Auswertungswerkzeug direkt auf die
Fachdatenbank zu richten wäre der schnellste Weg zu Berichten – und der sicherste Weg,
jede spätere Schemaänderung unmöglich zu machen.

## Betrachtete Alternativen

### Backend-for-Frontend

Ein eigener Dienst, der für das Frontend aggregiert und Token entgegennimmt.

Nicht gewählt – siehe oben. Erneut zu bewerten, sobald eine Ansicht Daten aus drei oder
mehr Services zusammenführt und der Browser dafür ebenso viele Aufrufe absetzen müsste.

### Micro-Frontends je Service

Erlaubt unabhängige Auslieferung der Oberfläche je fachlichem Bereich.

Nicht gewählt: löst ein Problem, das bei dieser Teamgröße nicht existiert.

### Alles im Frontend visualisieren, ohne Auswertungswerkzeug

Weniger Bestandteile.

Nicht gewählt: §10 verlangt selbstkonfigurierbare Ad-hoc-Berichte und Exporte in vier
Formaten. Das nachzubauen ist erheblicher Aufwand für etwas, das ausgereifte
Open-Source-Werkzeuge liefern.

## Konsequenzen

### Positiv

- Eine Oberfläche, eine Auslieferung, ein Gestaltungssystem.
- Kein zusätzlicher Dienst im Anfragepfad.
- Auswertungen greifen auf das Lesemodell zu; Schemaänderungen der Services bleiben
  möglich.

### Negativ und Risiken

- **CORS ist je Service zu konfigurieren.** Vergisst man es bei einem neuen Service,
  scheitert das Frontend – erkennbar, aber lästig. Gehört in die Prüfliste aus
  [service-setup.md](../development/service-setup.md).
- **Der Browser kennt die Pfade aller Services.** Die interne Aufteilung ist damit nach
  außen sichtbar.

> **Präzisierung 2026-08-05.** Die ursprüngliche Fassung sprach hier von einer „Spannung
> zum Zero-Trust-Modell aus §13". Das ist irreführend und wird richtiggestellt:
>
> **Kein Gateway bedeutet nicht, dass jeder Service unmittelbar im Netz steht.** Der
> Ingress bleibt der einzige Netzwerkeingang und leitet nach Pfad weiter; die Services
> selbst sind nur über ihn erreichbar, sofern die Netzwerkrichtlinien aus `PROD-006`
> stehen. Ingress und API-Gateway sind verschiedene Dinge – Ersteres brauchen wir
> ohnehin, Letzteres ist vertagt.
>
> Zero Trust verlangt **kein** Gateway. Es verlangt, dass kein Dienst einem Aufruf
> aufgrund seiner Netzwerkherkunft vertraut – und genau das ist erfüllt: Jeder Service
> prüft jedes Token selbst. Ein Gateway als *alleiniger* Prüfpunkt wäre sogar der
> Verstoß gegen §13, weil er eine harte Schale mit weichem Kern erzeugt.
>
> Was tatsächlich fehlt, ist ein zentraler Ort für Policy-Entscheidungen, Token-Tausch,
> Aggregation und einheitliche Anfrageprüfung. Die Entscheidung trägt sicherheitlich
> unter der Bedingung, dass `PROD-006`, `PROD-007` und `PROD-032` vor dem Produktivgang
> umgesetzt sind.
- **Der Frontend-Client im Realm sammelt Audience-Mapper**, einen je aufgerufenem
  Service. Wird einer vergessen, lehnt der betreffende Service jedes Token ab – mit einer
  Meldung, die auf den Service zeigt statt auf den Realm.
- **Mehrere Aufrufe je Ansicht**, wenn eine Seite Daten aus verschiedenen Services
  zusammenführt. Ab drei Services in einer Ansicht ist die BFF-Frage neu zu stellen.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Client-Generator und Aufbau des Frontends | M2 |
| CORS-Konfiguration je Service | mit dem jeweiligen Service |
| Auswahl des Auswertungswerkzeugs (Superset, Metabase) | M8 |
| Aufbau des Lesemodells aus §10 | M8 |
| Einführung eines Gateways oder BFF | bei drei Services je Ansicht oder wenn §13 es erzwingt |
