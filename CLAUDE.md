# CLAUDE.md

# Projekt: Anforderungs- und Kapazitätsmanagement-Plattform

## 0. Oberste Regel – Rolle der KI

Die KI (Claude) ist aktiver technischer Berater, Zuarbeiter und Reviewer. Die Kontrolle
über das Repository liegt ausschließlich beim Menschen.

> **Geändert am 2026-08-05.** Bis dahin galt: „Die KI schreibt selbst keine Zeile
> Produktivcode" – sie durfte ausschließlich Spezifikationen und als nicht-produktiv
> gekennzeichnete Beispiele liefern. Diese Einschränkung ist aufgehoben. Die KI liefert
> nun **konkrete, übernahmefähige Code-Vorgaben**. Unverändert bleibt, dass sie diesen
> Code **nicht selbst in das Repository schreibt**. Die frühere Fassung steht in der
> Versionsgeschichte.

Erlaubt und erwartet:

- Dokumentation **direkt im Repository anlegen und pflegen** (Architektur, Konzepte, ADRs,
  README, Schnittstellenbeschreibungen, Betriebsdokumentation)
- **Konkrete Code-Vorgaben liefern** – vollständige Dateien, Ausschnitte, Konfiguration,
  Tests –, ausdrücklich zur Übernahme bestimmt, mit Angabe des Zielpfads
- Konkrete ToDos vorgeben: was in welcher Reihenfolge zu tun ist, jeweils mit dem
  zugehörigen Code
- Aktive Vorschläge für den jeweils nächsten Schritt, inkl. Begründung
- Detaillierte Installationsanweisungen für Pakete, Bibliotheken und Werkzeuge (Befehle,
  Versionen, Konfiguration)
- Nach einer vom Menschen durchgeführten Implementierung: prüfen, ob diese korrekt und
  vollständig umgesetzt wurde, Abweichungen und Risiken benennen
- Lesenden Zugriff auf bestehenden Code nutzen, um ihn zu verstehen, zu erklären, zu
  analysieren und Reviews durchzuführen

Nicht erlaubt:

- **Kein schreibender Zugriff auf Anwendungs- und Konfigurationscode.** Die KI schreibt
  weder Quelldateien noch Konfigurationsdateien selbst in das Repository – das Einfügen,
  Prüfen und Committen erfolgt ausschließlich durch einen Menschen
- Kein Committen, kein Pushen, kein Ändern von Repository-Einstellungen

Ausgenommen von der Schreibsperre ist ausschließlich Dokumentation unterhalb von `docs/`
sowie `README.md`-Dateien.

## Diese Regel gilt uneingeschränkt für alle Abschnitte dieses Dokuments und alle abgeleiteten Arbeitsanweisungen.

## 1. Projektbeschreibung

Es soll eine webbasierte Plattform entwickelt werden, die die strukturierte Aufnahme, Verwaltung und Nachverfolgung von Projektanforderungen über den gesamten Lebenszyklus ermöglicht.

Die Plattform dient zwei Hauptzielgruppen:

1. Anwender
   - Erfassen und verfolgen Anforderungen
   - Transparenz über Status und Fortschritt
   - Kommunikation und Entscheidungsnachvollziehbarkeit
2. Plattformbetreiber
   - Zentrale Übersicht aller Anforderungen
   - Kapazitätsplanung und Ressourcensteuerung
   - Verwaltung der technischen Infrastruktur
   - Forecasting zukünftiger Hardwarebedarfe

Die Plattform muss **ausschließlich auf Open-Source-Software** basieren (harte Anforderung, keine Ausnahmen für Kernkomponenten).

---

# 2. Grundprinzipien

- Security by Design
- Open Source First
- API First
- Cloud Native Prinzipien
- Microservice Architecture
- Clean Architecture
- Loose Coupling
- High Cohesion
- **Test-Driven Design** (Tests entstehen vor bzw. parallel zur Implementierung, nicht nachträglich)
- Automatisierte Tests
- Automatisierte Security Checks
- Vollständige Nachvollziehbarkeit von Änderungen und Entscheidungen
- Dokumentation als Bestandteil der Entwicklung

---

# 3. Technologieanforderungen

## Frontend

- TypeScript, JavaScript, React, Next.js

Anforderungen:

- Strict TypeScript Mode, keine impliziten any-Typen
- komponentenbasierte Architektur, wiederverwendbare UI-Komponenten
- klare Trennung zwischen UI, Business Logic und Datenzugriff
- automatisierte Validierung, typsichere API-Kommunikation

Bevorzugte Open-Source-Komponenten:

- React, Next.js, TypeScript, TanStack Query, OpenAPI Client Generator, Open-Source UI Framework

---

# 4. Backend Architektur

Microservice-Architektur. Jeder Service besitzt eigene fachliche Verantwortung, eigene API, eigene Datenhaltung sofern sinnvoll, unabhängige Skalierbarkeit, unabhängiges Deployment.

Kommunikation:

- REST APIs
- Events / Messaging sofern erforderlich
- versionierte Schnittstellen
- **Service-zu-Service-Interaktionen laufen über dedizierte Service Accounts**, wenn die Aktion keinem konkreten Nutzer zuzuordnen ist (z. B. automatisierte Overhead-Neuberechnung, geplante Forecast-Läufe, interne Synchronisation). Service Accounts sind eigenständige Identitäten im Identity & Access Service, mit eigenen, minimal notwendigen Berechtigungen (Least Privilege) und eigener Auditspur – niemals ein geteilter „System"-Account für alle Services

---

# 5. Fachliche Services

## Identity & Access Service

Benutzerverwaltung, Rollen, Berechtigungen, Authentifizierung, Autorisierung, Verwaltung von Service Accounts, Auditierung von Berechtigungsänderungen

## Requirement Service

Anforderungen, Projekte, Status, Workflows, Lebenszyklus, Kommentare, Anhänge, Historisierung

## Capacity Service

Kapazitäten, Ressourcenverbrauch, Forecasting, Auslastungsberechnung, Wachstumsszenarien, Overhead-Berechnung je Service-Bestellung

## Infrastructure Service

Rechenzentren, Regionen, Standorte, Räume, Racks, Server, Netzwerkkomponenten, Hardwaretemplates, Bereitstellungskategorien, Service-Typ-Katalog, Kapazitätspools je Kategorie

## Audit Service

Änderungsverfolgung, Entscheidungen, Freigaben, Compliance-Nachweise

---

# 6. Dynamisches Anforderungsmodell

Grundmodell:

- **Core Entity**: feste, fachlich stabile Felder (id, project_id, requirement_type, status, owner, created_at, updated_at, version)
- **Dynamic Attributes**: fachliche Zusatzattribute als strukturierte Werte (z. B. JSONB) am Objekt
- **Attribute-Definition** ist selbst Fachdaten, nicht Code:
  - Attributname, Datentyp, Pflichtfeld, Wertebereich/Enum, Default
  - Gültigkeit je Anforderungstyp / Projektkategorie
  - Sichtbarkeit und Editierbarkeit je Rolle (UI)
  - „API-beschreibbar" (ja/nein)
  - „API-überschreibbar" (ja/nein/nur-wenn-leer) – **Globaler Default: Überschreiben ist erlaubt**, Einschränkungen sind Opt-out je Feld
  - Optional: Einschränkung auf bestimmte API-Clients/Rollen
  - Versionierung von Attributdefinitionen
- Validierung zur Laufzeit gegen aktuell gültige Attributdefinition (z. B. JSON Schema)
- Administration über Requirement Service (Admin-UI), keine Code-Änderung nötig

---

# 7. Workflow Engine (konfigurierbare Workflows)

- Workflows als Zustandsgraph (State Machine): Status, Übergänge, Bedingungen, benötigte Berechtigung je Übergang
- Übergänge können Pflichtfelder, Vier-Augen-Prinzip oder Genehmigungsschritte erzwingen
- Workflow-Definitionen versioniert; laufende Anforderungen bleiben auf Ursprungsversion
- Konfiguration über Admin-UI/Config statt Redeploy
- Jeder Statuswechsel historisiert (Audit Service)

Bevorzugte Open-Source-Bausteine: eigene State-Machine + Regel-Engine (json-rules-engine), Camunda/Zeebe für komplexere Fälle

---

# 8. Feingranulares Berechtigungsmodell

- RBAC als Basis + ABAC für Objekt-, Feld- und Aktionsebene
- Berechtigungsdimensionen: Service → Ressourcentyp → Einzelobjekt → Attribut/Feld → Aktion
- Mandantenfähigkeit/Scoping nach Projekt, Organisation, Region, Kostenstelle
- Policy-as-Code: versioniert, testbar, auditierbar
- API-Clients und Service Accounts sind eigenständige Identitäten mit eigenen Rollen (kein pauschaler Vollzugriff)
- Feldebene gilt für UI, API und Service-zu-Service-Aufrufe gleichermaßen
- Konfliktregel bei gleichzeitiger UI-/API-Pflege je Feld konfigurierbar (Default: Überschreiben erlaubt)

Bevorzugte Open-Source-Bausteine: Keycloak, Open Policy Agent (OPA) oder OpenFGA

---

# 9. Forecasting (Detaillierung Capacity Service)

- Historische Verbrauchsdaten als Zeitreihen
- Konfigurierbare Prognosemodelle: linear, saisonal, szenariobasiert
- Was-wäre-wenn-Szenarien
- Rückkopplung zum Infrastructure Service für Kapazitätsabgleich
- Nachvollziehbare Prognoseergebnisse (Modell, Annahmen, Zeitpunkt)
- Differenzierung nach Bereitstellungskategorie (Abschnitt 17), getrennt sowie aggregiert ausgewiesen

Bevorzugte Open-Source-Bausteine: TimescaleDB/InfluxDB, Prophet/statsmodels

---

# 10. Reporting

- Getrenntes Reporting-/Analytics-Modell (Read-Model, ggf. CQRS)
- Vordefinierte Standardreports + selbstkonfigurierbare Ad-hoc-Reports
- Exportformate: CSV, XLSX, PDF, JSON
- Zugriff respektiert dieselben feingranularen Berechtigungen

Bevorzugte Open-Source-Bausteine: Metabase, Apache Superset

---

# 11. Visualisierung

- Konfigurierbare Dashboards: Auslastung, Forecast, Anforderungsstatus, Durchlaufzeiten
- Widget-basiert, rollenabhängige Sichtbarkeit
- Trennung: technische/Infrastruktur-Metriken vs. fachliche/Business-Visualisierung

Bevorzugte Open-Source-Bausteine: Grafana, Apache Superset, eigene React-Komponenten (Recharts/ECharts)

---

# 12. Datenbereitstellung zur Weiterverarbeitung

- Versionierte, öffentliche Lese-APIs (REST, OpenAPI-dokumentiert)
- Event-Streaming für Near-Realtime-Integration
- Batch-Exportschnittstellen (CSV/Parquet) für Data-Warehouse-/Data-Lake-Anbindung
- Schema-Registry/Datenkatalog

Bevorzugte Open-Source-Bausteine: Apache Kafka/NATS, MinIO, Airbyte

---

# 13. Sicherheit (Ergänzung zu Security by Design)

- Secrets-Management: HashiCorp Vault
- mTLS zwischen Services, Zero-Trust-Netzwerkmodell
- Verschlüsselung at rest und in transit
- Automatisierte Security-Checks in CI/CD: Dependency-Scanning, Container-Scanning (Trivy), SAST/DAST
- Vollständige Auditierung sicherheitsrelevanter Ereignisse, inkl. Service-Account-Aktivität

---

# 14. Deployment & Betrieb

- Kubernetes, GitOps (ArgoCD/Flux)
- CI/CD: GitLab CI oder GitHub Actions
- Observability: OpenTelemetry, Prometheus, Grafana, Loki
- Unabhängiges Deployment je Microservice, versionierte Schnittstellen

---

# 15. Nicht-funktionale Anforderungen

- Skalierbarkeit horizontal je Service
- Hohe Verfügbarkeit, definierte SLOs
- Mandantenfähigkeit, Internationalisierung, Barrierefreiheit (WCAG)

---

# 16. API-basierte Datenpflege (Schreibzugriff)

- Jedes Feld (Core wie dynamisches Attribut) ist potenziell über API befüllbar
- Admin konfiguriert je Attribut, ob API-beschreibbar/-überschreibbar (Abschnitt 6)
- **Globaler Default: Überschreiben erlaubt**, restriktivere Regeln sind Opt-out
- Durchsetzung zur Laufzeit, geprüft gegen Attribut-Definition **und** Berechtigungsmodell (Abschnitt 8)
- Jede API-Schreiboperation historisiert und auditiert, inkl. Herkunft (Client-ID/Service-Account) und alter/neuer Wert
- Gleiche Validierung wie im UI-Formular

---

# 17. Bereitstellungskategorien (Cloud / Legacy-Rechenzentrum / Hybrid / KI / weitere)

- Kategorien sind Stammdaten im Infrastructure Service, ohne Redeploy erweiterbar/änderbar
- Je Kategorie: eigene Pflicht-/Zusatzattribute, eigener Satz zulässiger Service-Typen, eigene Kapazitätspools
- Gleicher fachlicher Service kann je Kategorie unterschiedlich ausgeprägt sein (Cloud-Managed vs. Legacy-Server), mit eigenem Overhead-Modell (Abschnitt 18)
- Bestellungen referenzieren genau eine Kategorie
- Reporting/Visualisierung/Forecasting filterbar je Kategorie und aggregierbar
- Änderungen an Kategorien versioniert und auditiert

---

# 18. IT-Service-Katalog & Overhead-Modell

## Service-Typ-Katalog

- Service-Typen sind Stammdaten im Infrastructure Service
- Je Service-Typ: Name, Kategorie(n), bestellbare Parameter
- Service-Typ kann je Kategorie unterschiedlich ausgeprägt sein (eigene Parameter, Overhead-Modell, Genehmigungsregeln)
- Versioniert je Kategorie

## Overhead-Modell je Service-Typ und Kategorie

- Konfigurierbare Formel/Faktorenliste statt Hardcoding (z. B. K8s: Control-Plane-Nodes, HA-Overhead; DB: Replikationsfaktor, Backup-Storage-Multiplikator)
- Versioniert je Service-Typ, Kategorie und Zeitpunkt
- Änderungen wirken nur auf neue Bestellungen/Forecasts, nicht rückwirkend

## Bestellung (Order)

- Instanz eines Service-Typs in einer Kategorie mit konkreten Nettoparametern
- Läuft über denselben Workflow-Mechanismus wie andere Anforderungen (Abschnitt 7)
- Capacity Service berechnet Bruttokapazität aus Nettoparametern + Overhead-Modell

## Integration

- Requirement Service: Bestellung als Objekt inkl. Workflow
- Capacity Service: Overhead-Berechnung, Forecasting-Input
- Infrastructure Service: Kapazitätsprüfung/-reservierung gegen passenden Pool der Kategorie
- Änderungen am Overhead-Modell/an Kategorien: Auditierungsereignis
