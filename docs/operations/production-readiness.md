# Produktionsreife – offene Punkte

Dieses Dokument sammelt **alles, was geändert werden muss, bevor die Plattform in einer
produktiven Umgebung betrieben werden darf.**

Der Grund für seine Existenz: In der Entwicklung werden laufend bewusste Abkürzungen
genommen – unverschlüsselte Verbindungen, triviale Zugangsdaten, abgeschaltete
Sicherheitsmechanismen. Jede einzelne ist für sich vertretbar und im Moment ihrer
Entstehung offensichtlich. Sechs Monate später ist sie es nicht mehr. Ohne diese Liste
gehen genau die Punkte verloren, deren Vergessen am teuersten ist.

---

## Pflegeregel

> **Diese Datei wird fortgeschrieben, sobald ein neues Thema auftaucht.**
>
> Wird eine Entwicklungsabkürzung genommen, ein Sicherheitsmechanismus abgeschaltet, ein
> Standardwert übernommen oder ein Punkt auf „später" vertagt, wird er **im selben
> Arbeitsschritt** hier eingetragen – nicht am Ende des Meilensteins und nicht kurz vor
> dem Produktivgang.
>
> Ein Eintrag wird nie gelöscht. Er wechselt seinen Status auf `Erledigt`, mit Datum und
> Verweis auf die umsetzende Änderung. Nur so bleibt nachvollziehbar, dass ein Risiko
> bewusst geschlossen und nicht übersehen wurde.

Das gilt für alle Beteiligten, einschließlich der KI in ihrer Beraterrolle
(CLAUDE.md §0): Wer eine Abkürzung vorschlägt, trägt sie hier ein.

---

## Legende

**Status:** `Offen` · `In Arbeit` · `Erledigt` · `Bewusst akzeptiert`

**Schwere:**

| Stufe | Bedeutung |
|---|---|
| **Kritisch** | Produktivgang ist ohne Umsetzung ausgeschlossen. Direktes Sicherheits- oder Datenverlustrisiko. |
| **Hoch** | Produktivgang nur mit dokumentierter, befristeter Ausnahme und Kompensationsmaßnahme. |
| **Mittel** | Muss vor dem Regelbetrieb umgesetzt sein, blockiert aber keinen begrenzten Pilotbetrieb. |

---

## Stand

| Bereich | Einträge | davon kritisch | erledigt |
|---|---|---|---|
| A – Transportverschlüsselung und Netzwerk | 7 | 5 | – |
| *davon Voraussetzung für ADR-0013:* | `PROD-006`, `PROD-007`, `PROD-032` | | |
| B – Geheimnisse und Zugangsdaten | 5 | 4 | – |
| C – Identität und Zugriff | 11 | 2 | – |
| D – Daten | 6 | 3 | – |
| E – Container und Lieferkette | 9 | 1 | **2** |
| F – Betrieb und Verfügbarkeit | 6 | 1 | – |
| G – Anwendungssicherheit | 8 | 1 | – |
| **Gesamt** | **52** | **17** | **2** |

> **Nummern werden nicht neu vergeben.** `PROD-026` ist unbesetzt. Eine Lücke ist kein
> Fehler – eine wiederverwendete Nummer wäre einer, weil Verweise aus ADRs, Commits und
> Pull Requests dann auf etwas anderes zeigen als zum Zeitpunkt ihrer Entstehung.

**Stand 2026-08-06**, Abschluss von Meilenstein M1: Zwei Einträge erledigt – `PROD-022`
und `PROD-036`, beide zur Lieferkette. Sie wurden vorgezogen, weil ihre Voraussetzung
(Renovate im Betrieb) mit M1 erfüllt war und eine unbeaufsichtigte Festlegung ohne
automatische Aktualisierung schlechter wäre als gar keine.

Die übrigen 47 bleiben offen. Das ist für diesen Projektstand erwartbar: Der überwiegende
Teil betrifft Betrieb, Verschlüsselung und Geheimnisverwaltung und wird erst mit der
ersten nicht-lokalen Umgebung greifbar.

**Zugang zu Beginn von M2.3:** Vier Einträge (`PROD-042` bis `PROD-045`) aus den
Entscheidungen ADR-0014 und ADR-0015. Keiner davon ist ein Umsetzungsfehler – alle vier
sind die benannten Kehrseiten zweier bewusst getroffener Festlegungen. Genau dafür ist
diese Liste da: Eine Entscheidung, deren Nachteil nirgends steht, ist eine Entscheidung,
die beim nächsten Mal niemand mehr überprüft.

---

## A – Transportverschlüsselung und Netzwerk

#### PROD-001 — Keycloak läuft im Entwicklungsmodus ohne TLS
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `command: ["start-dev", ...]`

`start-dev` schaltet HTTPS ab und deaktiviert die strikte Hostnamen-Prüfung. Tokens und
Anmeldedaten gehen im Klartext über die Leitung.

**Zielzustand:** `start` mit `KC_HOSTNAME`, `KC_HTTPS_CERTIFICATE_FILE` bzw. TLS-Abschluss
am Ingress, `KC_HOSTNAME_STRICT=true`, `KC_PROXY_HEADERS=xforwarded` bei vorgelagertem
Proxy.

#### PROD-002 — Realm erzwingt kein HTTPS
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `sslRequired: "none"`

**Zielzustand:** `"all"`. Der Wert `"external"` ist nur zulässig, wenn nachweislich
ausschließlich vertrauenswürdige interne Netze unverschlüsselt zugreifen – was mit dem in
§13 geforderten Zero-Trust-Modell unvereinbar ist.

#### PROD-003 — Keine gegenseitige TLS-Authentifizierung zwischen Services
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

§13 fordert mTLS zwischen Services und ein Zero-Trust-Netzwerkmodell. Derzeit existiert
weder das eine noch das andere; Service-zu-Service-Aufrufe sind bislang ohnehin nicht
implementiert.

**Zielzustand:** mTLS über ein Service Mesh oder eine eigene Zertifikatsverwaltung
(cert-manager). Entscheidung fällig, sobald der zweite Service existiert.

#### PROD-004 — Datenbankverbindungen sind unverschlüsselt
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `KC_DB_URL`

Die Verbindungszeichenfolge enthält keine TLS-Parameter. Zugangsdaten und Nutzdaten
gehen im Klartext zur Datenbank.

**Zielzustand:** `sslmode=verify-full` mit hinterlegter Zertifizierungsstelle für alle
Datenbankverbindungen, einschließlich der von Keycloak.

#### PROD-005 — Keycloak-Verwaltungsport ist nach außen abgebildet
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `ports: "9000:9000"`

Port 9000 liefert Health- und Metrikendaten. Er darf ausschließlich clusterintern
erreichbar sein.

**Zielzustand:** Keine Port-Abbildung nach außen; Zugriff nur durch Prometheus und die
Orchestrierungsschicht.

#### PROD-006 — Keine Netzwerkrichtlinien
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13, §14

Ohne NetworkPolicies kann jeder Pod jeden anderen erreichen. Ein kompromittierter Dienst
hat damit unmittelbaren Zugriff auf alle Datenbanken.

**Zielzustand:** Standardverweigerung, danach ausschließlich explizit erlaubte
Verbindungen – insbesondere darf ein Service nur seine eigene Datenbank erreichen
([ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)).

#### PROD-007 — CORS: Ursprünge auf localhost, Konfiguration je Service erforderlich
**Schwere:** Hoch · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `webOrigins`, `redirectUris`

**Zielzustand:** Umgebungsspezifische Werte über Variablenersetzung in
`keycloak-config-cli`. Platzhalterwerte wie `*` sind unzulässig.

> **Verschärft am 2026-08-05 durch [ADR-0013](../adr/0013-frontend-zuschnitt-und-zugriffsweg.md).**
> Der Browser spricht die Service-APIs direkt an. Damit ist CORS **je Service** zu
> konfigurieren, nicht einmal zentral an einem Gateway.
>
> Das vervielfacht die Fehlermöglichkeit: Ein einziger Service mit `*` in
> `Access-Control-Allow-Origin` hebt die Herkunftsprüfung für die gesamte Anwendung aus,
> ohne dass irgendetwas rot wird. Die Prüfung gehört in die Freigabe jeder Umgebung und
> steht in der Prüfliste unter
> [service-setup.md](../development/service-setup.md).
>
> Von Mittel auf **Hoch** angehoben: Die Schwere hängt nicht mehr an einem falschen
> localhost-Eintrag, sondern an einer wiederkehrenden Konfiguration mit stiller
> Fehlerwirkung.

> **Wieder auf Mittel gesenkt am 2026-08-06 durch
> [ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md).**
> Der Browser spricht die Services nicht mehr direkt an, sondern über das
> Backend-for-Frontend. Für den Oberflächenpfad entfällt CORS damit vollständig – ein
> Ursprung statt N.
>
> **Nicht entfallen** ist es für externe Konsumenten nach §12: Die rufen die Services
> weiterhin unmittelbar auf. Der Unterschied ist, dass es dort um wenige, bekannte
> Konsumenten geht statt um eine Konfiguration, die bei jedem neuen Service wiederholt
> werden muss.

---

## B – Geheimnisse und Zugangsdaten

#### PROD-008 — Datenbankzugangsdaten stehen im Klartext im Repository
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/postgres/init/01-databases.sql`, `infra/local/compose.yaml`

Rollen und Passwörter (`keycloak`/`keycloak`, `requirement`/`requirement`) sind fest
hinterlegt. Für die lokale Umgebung bewusst so gewählt und dort unbedenklich.

**Zielzustand:** Erzeugung und Verteilung über HashiCorp Vault. Kein Zugangsdatum in
irgendeiner Form im Repository, auch nicht in Vorlagen.

#### PROD-009 — Keycloak-Administrator ist `admin`/`admin`
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `KC_BOOTSTRAP_ADMIN_*`

**Zielzustand:** Einmaliges Bootstrap-Konto mit erzeugtem Passwort aus Vault,
unmittelbar nach der Einrichtung deaktiviert. Verwaltungszugriff danach ausschließlich
über personengebundene Konten mit zweitem Faktor.

#### PROD-010 — Kein Geheimnisverwaltungssystem vorhanden
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

§13 benennt HashiCorp Vault. Es existiert bislang keine Anbindung.

**Zielzustand:** Vault mit automatischer Erneuerung, kurzlebigen Datenbankzugangsdaten
und Anbindung an die Orchestrierungsschicht. Fällig vor der ersten nicht-lokalen
Umgebung.

#### PROD-011 — Testbenutzer mit Passwort im Realm hinterlegt
**Schwere:** Kritisch · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `users`

Die Benutzer `test.author` und `test.admin`, beide mit dem Passwort `test`, sind
Bestandteil der Realm-Definition und würden bei unveränderter Anwendung in jede Umgebung
mitwandern.

**`test.admin` trägt `platform-admin`** – also das Recht, Attributdefinitionen und
Hoheitsregeln zu ändern. Ein solcher Zugang mit trivialem Passwort in einer produktiven
Umgebung wäre die Übernahme des Datenmodells, nicht nur ein Lesezugriff. Der Eintrag wiegt
damit schwerer als bei seiner Aufnahme, als es nur einen Autor gab.

**Zielzustand:** Testbenutzer in eine getrennte, ausschließlich lokal angewandte
Ergänzungsdatei auslagern. Die Basis-Realm-Definition enthält keine Benutzer.

> Zwei Benutzer statt einem ist Absicht: Mit nur einem Zugang, der alles darf, ließe sich
> nicht mehr prüfen, ob ein Autor die Verwaltung tatsächlich nicht bedienen kann.

#### PROD-012 — Client-Geheimnisse noch nicht externalisiert
**Schwere:** Hoch · **Status:** ~~Offen~~ **Erledigt (2026-08-06)** · **Betrifft:** §4, §13

> **Umgesetzt in M2.1.** Mit dem Wechsel des Clients `frontend` auf vertraulich entstand
> das erste Client-Secret. Die Variablenersetzung war vorher da, nicht nachher:
> `IMPORT_VARSUBSTITUTION_ENABLED=true` im Dienst `keycloak-config`, Platzhalter
> `$(env:FRONTEND_CLIENT_SECRET)` in der Realm-Definition, Wert lokal aus
> `infra/local/local.env`.
>
> **Geprüft**, nicht angenommen: `select public_client, secret is not null from client`
> liefert für `frontend` `f | t` – der Platzhalter wurde ersetzt und nicht als Literal
> übernommen.
>
> Ein Wächter im CI-Job `lint` bricht den Build, sobald in der Realm-Definition ein
> `"secret"` ohne `env:` steht. Trivys Geheimnis-Scanner hätte das nicht gefunden – er
> erkennt bekannte Formate, kein selbstvergebenes Client-Secret.
>
> **Woher der Wert in nicht-lokalen Umgebungen kommt, regelt `PROD-010`** (Vault). Dieser
> Eintrag betraf den Mechanismus, nicht die Quelle.

Sobald Service Accounts angelegt werden ([ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)),
entstehen vertrauliche Clients mit Geheimnissen.

**Zielzustand:** Variablenersetzung in `keycloak-config-cli`
(`IMPORT_VARSUBSTITUTION_ENABLED=true`), Werte aus Vault. Umzusetzen **bevor** der erste
Service Account entsteht – nachträglich bedeutet es, ein bereits im Verlauf der
Versionsgeschichte veröffentlichtes Geheimnis auszutauschen.

> **Verschärft am 2026-08-04:** Das Repository `kn0rr/InfraDemand` ist **öffentlich**.
> Ein versehentlich gepushtes Geheimnis ist damit keine interne Hygienefrage, sondern
> eine sofortige Veröffentlichung – und über die Ereignis-API auch nach dem Löschen des
> Commits weiterhin abrufbar. Die Externalisierung muss abgeschlossen sein, **bevor** der
> erste vertrauliche Client angelegt wird, nicht danach. Dasselbe gilt sinngemäß für
> PROD-008 und PROD-011.

---

## C – Identität und Zugriff

#### PROD-013 — Passwort-Grant am Frontend-Client aktiviert
**Schwere:** Kritisch · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `directAccessGrantsEnabled: true`

Bewusst aktiviert, damit Integrationstests ohne Browser-Anmeldefluss ein Token beziehen
können. In einer produktiven Umgebung umgeht dieser Grant sämtliche
Anmeldeflusssicherungen einschließlich zweitem Faktor.

**Zielzustand:** `false`. Tests in nicht-lokalen Umgebungen verwenden einen eigenen
Testclient, nicht den Frontend-Client.

> **Teilweise umgesetzt in M2.1.** Der Client `frontend` steht auf
> `directAccessGrantsEnabled: false` – der Passwort-Grant umgeht dort keine
> Anmeldeflusssicherung mehr. Der Oberflächen-Client kann jetzt ausschließlich das, was
> die Oberfläche tatsächlich tut.
>
> **Verbleibend:** Der eigens angelegte Client `test-cli` hat den Grant und steht in
> derselben Realm-Datei wie die produktive Konfiguration – ebenso wie der Testbenutzer aus
> `PROD-011`. Beide gehören in eine **nur lokal angewandte Ergänzungsdatei**, damit die
> Basis-Realm-Definition in jede Umgebung gereicht werden kann. Das ist die gemeinsame
> Restaufgabe von PROD-011 und PROD-013.

#### PROD-014 — Keine Passwortrichtlinie, kein zweiter Faktor
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** Passwortrichtlinie im Realm, zweiter Faktor verpflichtend für
`platform-admin`, empfohlen für alle übrigen Rollen.

#### PROD-015 — Kein Schutz gegen automatisiertes Durchprobieren
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** Brute-Force-Erkennung im Realm aktiviert, mit abgestimmten
Sperrzeiten.

#### PROD-016 — Token-Lebensdauern nicht abgestimmt
**Schwere:** Mittel · **Status:** Offen · **Fundstelle:** `infra/keycloak/realms/infrademand.json`, `accessTokenLifespan: 300`

Der Wert ist gesetzt, aber nicht gegen ein Widerrufskonzept abgestimmt. Ohne Widerruf
bleibt ein entwendetes Token bis zum Ablauf gültig.

**Zielzustand:** Abgestimmte Lebensdauern für Zugriffs-, Erneuerungs- und Sitzungstoken,
dokumentiertes Widerrufsverfahren, Prüfung gegen die Rollenkritikalität.

#### PROD-017 — Feingranulare Autorisierung fehlt
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §8 · **Verweis:** [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)

Objekt- und Feldebene aus §8 ist noch nicht umgesetzt; die Policy-Engine ist bewusst bis
M5 vertagt. Ein Produktivgang vor M5 ist damit ausgeschlossen.

> **Ergänzt am 2026-08-07 mit M3.2.** Seither gibt es eine **grobe** Rollenprüfung:
> `@Rollen("platform-admin")` über einen zweiten `APP_GUARD`. Sie schützt die
> Attributdefinitionen, weil deren Änderung das gültige Datenmodell umschreibt – „gar
> keine Prüfung" war dort die falsche Näherung.
>
> **Das erfüllt §8 nicht und darf nicht dafür gehalten werden.** Geprüft wird
> ausschließlich, ob das Token eine Realm-Rolle trägt. Objektbezug, Feldebene,
> Mandantenzuschnitt und Attributsichtbarkeit fehlen unverändert. Wer die vorhandene
> Prüfung für ausreichend hält, hält diesen Eintrag für erledigt – er ist es nicht.

> **Ergänzt am 2026-08-08.** `requirement-author` wird **nirgends geprüft**. Die Rolle
> steht im Realm, wandert ins Token und ist Gegenstand einer CI-Prüfung – aber der
> `RollenGuard` greift nur dort, wo `@Rollen` steht, und am Anlegen und Ändern von
> Anforderungen steht es nicht. **Jeder Angemeldete kann Anforderungen erfassen und
> ändern.**
>
> Das ist heute vertretbar, weil es nur einen Realm mit zwei Testbenutzern gibt. Gefährlich
> ist die Erscheinungsform: Die Rolle existiert sichtbar an drei Stellen und sieht deshalb
> nach einer Zusicherung aus, die es nicht gibt. Wer sie vergibt oder entzieht, ändert
> nichts.
>
> **Zielzustand:** Entweder wird die Rolle durchgesetzt, oder sie wird entfernt. Ein
> Zwischenzustand aus beidem ist die schlechteste Variante.

#### PROD-051 — Die Herkunftsregistratur ist ein Berechtigungsobjekt ohne Berechtigungsschutz
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §8, §19.3 · **Verweis:** [ADR-0017](../adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A4

Seit M3.4c entscheidet der Eintrag eines OAuth-Clients in `source_system` darüber, ob
seine Schreiboperationen als *automatisch* oder *manuell* gelten – und damit, ob die
Hoheitsregeln auf ihn zutreffen.

**Wer einen Client als `automatic` einträgt, hebt für ihn sämtliche Hoheitsregeln auf.**
`automatic_wins` und `manual_locked` beschränken ausschließlich manuelle Quellen; eine
automatische wird von keiner Regel abgewiesen. Ein einzelner Datensatz in einer
Stammdatentabelle setzt damit das gesamte Regelwerk für einen Aufrufer außer Kraft.

Heute schützt nur die grobe Rolle `platform-admin` – dieselbe, die auch Attributdefinitionen
pflegt. Ein Administrator, der Quellen eintragen darf, kann folglich jede Hoheitsregel
umgehen, ohne eine einzige Regel zu ändern.

**Zielzustand:** Die Registratur wird als eigenes Berechtigungsobjekt nach §8 geführt, mit
eigenem Recht für das Setzen der Klasse. Zusätzlich gehört die Änderung einer Klasse
auffällig auditiert – sie ist wirkungsgleich mit dem Abschalten aller Regeln für einen
Aufrufer. Gemeinsam mit `PROD-017` zu entscheiden, spätestens mit M5.

#### PROD-043 — Abmeldung endet an der Vermittlungsgrenze
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0015](../adr/0015-mehrere-identitaetsquellen.md)

Meldet sich ein über eine Fremdquelle vermittelter Anwender bei uns ab, endet zuverlässig
nur die Sitzung in unserem Realm. Die Sitzung bei der Ursprungsquelle – einer anderen
Keycloak-Instanz, Entra ID, ADFS – bleibt bestehen. Ein erneuter Anmeldeversuch führt dann
ohne Zutun des Anwenders zurück in die angemeldete Sitzung, was als „Abmeldung hat nicht
funktioniert" wahrgenommen wird.

Sicherheitlich relevant wird das an gemeinsam genutzten Arbeitsplätzen: Wer sich abmeldet
und den Platz verlässt, geht davon aus, dass die nächste Person neu anmelden muss.

**Zielzustand:** Für jede vermittelte Quelle ist festgelegt und dokumentiert, ob sie
abgemeldete Sitzungen rückwärts propagiert (OIDC RP-Initiated Logout bzw. SAML Single
Logout). Wo das nicht möglich ist, weist die Oberfläche nach der Abmeldung ausdrücklich
darauf hin, dass die Sitzung beim Identitätsanbieter fortbesteht.

#### PROD-044 — Vermittelte Merkmale sind nur so aktuell wie die letzte Anmeldung
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §8, §13 · **Verweis:** [ADR-0015](../adr/0015-mehrere-identitaetsquellen.md)

Bei der Anbindung fremder Quellen übernimmt Keycloak Merkmale und Gruppen zum Zeitpunkt
der Anmeldung. Wird ein Konto anschließend im Ursprungsverzeichnis deaktiviert oder aus
einer Gruppe entfernt, wirkt das **nicht sofort**, sondern frühestens beim nächsten
Anmelde- oder Erneuerungsvorgang.

**Folge:** Ein im Active Directory gesperrter Anwender kann bis zum Ablauf seiner Sitzung
weiterarbeiten. Das ist genau der Fall, für den eine Sperre gedacht ist – Austritt,
Freistellung, kompromittiertes Konto.

**Zielzustand:** Verbindliche Obergrenze für die Sitzungsdauer, abgestimmt mit `PROD-016`,
sodass die Wirkverzögerung einer Sperre bekannt und begrenzt ist. Zusätzlich zu prüfen:
periodischer Abgleich gegen die Ursprungsquelle statt ausschließlich bei der Anmeldung.
Hängt unmittelbar an `PROD-045` – solange die Sitzung nicht widerrufbar ist, ist die
Sitzungsdauer die einzige wirksame Stellschraube.

#### PROD-047 — Gleichzeitige Tokenerneuerung ist nicht abgestimmt
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md)

Der BFF erneuert das Zugriffstoken, sobald es abzulaufen droht. Treffen mehrere Anfragen
desselben Anwenders gleichzeitig ein – im Browser der Normalfall –, kann jede davon eine
eigene Erneuerung auslösen. Eine Absprache zwischen ihnen gibt es nicht: Die Sitzung liegt
im Cookie, es existiert kein gemeinsamer Zustand, an dem sich eine Sperre festmachen ließe
(`PROD-045`).

**Heute geht das gut, weil Keycloak in der Voreinstellung alte Erneuerungstoken nicht
widerruft.** Genau das ist die schwächere Einstellung. Wird *Revoke Refresh Token*
eingeschaltet – eine sinnvolle Härtung, weil sie die Wiederverwendung entwendeter Token
erkennbar macht –, entwertet die erste Erneuerung das Token der zweiten. Die Folge sind
sporadische, nicht nachstellbare Abmeldungen unter Last.

**Wir verlassen uns damit stillschweigend auf eine unsichere Voreinstellung.** Das ist der
eigentliche Eintrag hier, nicht die Gleichzeitigkeit selbst.

**Zielzustand:** Entscheidung gemeinsam mit `PROD-045`. Ein serverseitiger
Sitzungsspeicher löst beides zugleich – er gibt den Ort, an dem sich eine Erneuerung
serialisieren lässt. Bis dahin bleibt *Revoke Refresh Token* bewusst aus, und diese
Abhängigkeit ist hier festgehalten, damit sie beim nächsten Härtungsdurchgang nicht
versehentlich eingeschaltet wird.

#### PROD-046 — Ursprungsquelle einer Identität ist im Token nicht sichtbar
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §19.3 · **Verweis:** [ADR-0015](../adr/0015-mehrere-identitaetsquellen.md) Punkt 5

ADR-0015 verlangt einen Protocol Mapper, der den Alias der vermittelnden Quelle als
Anspruch in das Token schreibt. Er ist noch nicht angelegt.

**Solange der eigene Realm die einzige Quelle ist, hat das keine Wirkung** – Keycloak setzt
`identity_provider` ausschließlich bei vermittelten Anmeldungen, der Anspruch wäre bei
jedem Anwender abwesend. Der Eintrag steht hier nicht als Mangel des jetzigen Zustands,
sondern als Bedingung für einen künftigen.

**Auslöser:** die Anbindung der ersten Fremdquelle – im **selben** Arbeitsschritt, nicht
danach. Der maßgebliche Zeitpunkt ist nicht die Anbindung, sondern die erste
Schreiboperation eines vermittelten Anwenders: Ab dann verlangt §19.3 die Auskunft, welche
Quelle einen Wert gesetzt hat, und für bereits geschriebene Datensätze ist sie nicht
nachträglich herstellbar.

**Zielzustand:** Protocol Mapper im Client-Scope, versioniert über
`infra/keycloak/realms/`, mit einem Test, der den Anspruch für einen vermittelten Anwender
nachweist.

#### PROD-045 — Sitzung im Cookie ist nicht widerrufbar
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md)

Nach ADR-0014 ist die Sitzung zustandslos und liegt vollständig im verschlüsselten Cookie.
Das ist eine bewusste Entscheidung gegen zusätzliche Infrastruktur – sie hat aber eine
Folge, die dort nicht ausgeschrieben war:

**Es gibt keine Stelle, an der eine laufende Sitzung beendet werden kann.** Ein Widerruf
in Keycloak beendet die Sitzung dort, nicht bei uns. Das Cookie bleibt bis zu seinem
Ablauf gültig, weil seine Gültigkeit ausschließlich aus seinem Inhalt folgt. Eine
Sperrung wirkt erst, wenn der Erneuerungsvorgang das nächste Mal fehlschlägt.

Zweite, unabhängige Grenze derselben Entscheidung: Browser begrenzen ein Cookie auf
**4096 Byte**. Die Grenze wird nicht angekündigt – das Cookie wird stillschweigend nicht
gesetzt, und die Anmeldung schlägt ohne verwertbare Meldung fehl.

**Gemessen am 2026-08-06** nach Abschluss von M2.3, Anwender `test.author`:

| Bestandteil | Byte |
|---|---|
| Zugriffstoken (1 Realm-Rolle, 1 Zielgruppe) | 1143 |
| Erneuerungstoken | 712 |
| Sitzungsinhalt roh | 1855 |
| **Cookie einschließlich Name** | **3080** von 4096 – **75 %** |

Der Aufschlag durch Verschlüsselung und Base64 beträgt rund **das 1,5-fache**. Daraus folgt
die Steigung: **etwa 48 Byte je zusätzlicher Realm-Rolle**, etwa ebenso viel je weiterer
Zielgruppe. Der verbleibende Spielraum von rund 1000 Byte entspricht **ungefähr
20 Rollen**.

**Das ist der minimale Fall** – ein Anwender, eine Rolle, ein Service. §8 beschreibt
Berechtigungen über Service, Ressourcentyp, Einzelobjekt, Attribut und Aktion; ein solches
Modell erzeugt regelmäßig zweistellige Rollenzahlen. Mit dem zweiten Service kommen dessen
Zielgruppe und dessen Rollen hinzu. Nach ADR-0015 kommen bei vermittelten Anwendern
Merkmale der Ursprungsquelle dazu.

Dritte, kleinere Wirkung: Das Cookie wird bei **jeder** Anfrage an denselben Ursprung
mitgeschickt, auch für statische Dateien unter `/_next/static/`. Drei Kilobyte je Anfrage
sind kein Beinbruch, aber ein zusätzliches Argument gegen die zustandslose Ablage.

**Zielzustand:** Serverseitiger Sitzungsspeicher, im Cookie nur noch eine Kennung. Damit
sind Widerruf, Größe und Anfragelast zugleich gelöst.

**Auslöser für die Umsetzung – ersetzt den zuvor hier genannten Schwellwert von 3,5 KB.**
Ein Stand-Schwellwert war die falsche Kennzahl: Er misst, wo wir sind, nicht wie schnell
wir uns bewegen. Verbindlich ist stattdessen:

- **Spätestens vor M3.** Der zweite Service bringt Zielgruppe und Rollen mit; danach ist
  der Umbau teurer, weil der Weiterleitungspfad aus M2.4 daran hängt.
- **Sofort, wenn die gemessene Größe 3600 Byte überschreitet.**

**Die Überwachung fehlt noch.** Der Wert oben ist von Hand gemessen. Ein Eintrag in dieser
Liste warnt niemanden zum richtigen Zeitpunkt – die Grenze fällt sonst erst auf, wenn die
Anmeldung im Browser eines Anwenders stillschweigend nicht mehr greift. Erforderlich ist
ein Integrationstest, der den Anmeldefluss gegen einen laufenden Keycloak durchläuft und
bei mehr als 3600 Byte fehlschlägt. Das Frontend hat dafür bislang **keine
Testinfrastruktur** – Vitest ist nur in den Services eingerichtet
([ADR-0008](../adr/0008-teststrategie-und-testinfrastruktur.md)). Aufzubauen zu Beginn von
M2.4, gemeinsam mit den Tests des Weiterleitungspfads.

**Zur Wahl des Speichers ist nichts vorentschieden.** Die naheliegende Antwort –
PostgreSQL, das ohnehin läuft – widerspricht [ADR-0002](../adr/0002-repository-struktur.md):
Das Frontend hat bewusst keine eigene Datenhaltung. Die Entscheidung braucht daher ein
eigenes ADR und ist im Index der vertagten Entscheidungen geführt.

---

## D – Daten

#### PROD-053 — Abgewiesene automatische Schreiboperationen sieht niemand
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §16, §19.2 · **Verweis:** [ADR-0019](../adr/0019-verhalten-bei-abgewiesener-schreiboperation.md), [ADR-0022](../adr/0022-statuswechsel-als-eigener-vorgang.md)

Wird eine Schreiboperation automatischer Herkunft abgewiesen – durch eine Hoheitsregel,
eine Festhaltung oder ab M4.2 durch den Zustandsgraphen –, wird sie nach ADR-0019
**festgehalten statt zurückgemeldet**: Der Rest der Lieferung wird übernommen, die
Abweisung landet in `write_rejection`.

Das ist richtig entschieden. *Abweisen, wo jemand reagieren kann; festhalten, wo niemand
da ist* – ein Nachtlauf hat keinen Adressaten, und die ganze Lieferung scheitern zu lassen,
weil ein Feld gesperrt ist, wäre schlimmer.

**Es fehlt die Gegenseite.** Es gibt keine Ansicht, keine Kennzahl und keine Benachrichtigung
über den Inhalt dieser Tabelle. Wer nicht von sich aus hineinsieht, erfährt nie, dass das
Vorsystem und die Plattform auseinanderlaufen – und der Zweck des Festhaltens war, dass es
jemand bemerkt.

**Mit ADR-0022 wächst der Schaden.** Bisher konnten einzelne Feldwerte still verlorengehen.
Ab M4.2 kann es ein **Statuswechsel** sein: Liefert ein Vorsystem einen Zielzustand, für den
es im Graphen keinen Übergang gibt, bleibt die Anforderung stehen, während das Vorsystem sie
als fortgeschritten führt. Die Kapazitätsplanung rechnet dann mit einem Bestand, den es so
nicht gibt.

**Zielzustand:** Eine Übersicht der Abweisungen mit Filter nach Quelle und Zeitraum, eine
Kennzahl für die Beobachtbarkeit (§14) und eine Schwelle, ab der jemand aktiv benachrichtigt
wird. Die Frage, ob ein Dateiimport seine Abweisungen zusätzlich unmittelbar zurückmeldet,
ist als eigene Entscheidung geführt und fällt mit dem Dateiimport.

#### PROD-050 — Datentypwechsel einer Attributdefinition lässt vorhandene Werte ungeprüft zurück
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §6 · **Fundstelle:** `services/requirement/src/attribute-definitions/`

Der Datentyp einer Attributdefinition ist änderbar. Wird er gewechselt – etwa von `text`
auf `number` –, entsprechen die bereits in `dynamic_attributes` gespeicherten Werte der
neuen Definition nicht mehr. Es gibt weder eine Warnung noch einen Abgleich noch eine
Umwandlung.

**Die Änderung bleibt bewusst erlaubt.** Ein Vertipper beim Anlegen muss korrigierbar
sein, und bis zur ersten Anforderung mit diesem Attribut ist der Wechsel folgenlos. Ein
Verbot würde die Definition unbrauchbar machen, statt das Problem zu lösen.

**Die Wirkung tritt zeitversetzt und an anderer Stelle auf.** Die vorhandenen Werte werden
nicht rückwirkend geprüft; auffallen wird es beim nächsten Schreibvorgang auf denselben
Datensatz, wenn die Prüfung aus M3.3 den Altwert gegen die neue Definition hält und
ablehnt. Der Anwender sieht dann eine Ablehnung für ein Feld, das er nicht angefasst hat.

**Zielzustand:** Beim Wechsel des Datentyps zählt die Verwaltungsoberfläche die
betroffenen Datensätze und weist darauf hin. Zu entscheiden ist zusätzlich, was mit
Altwerten geschieht, die der neuen Definition nicht genügen – umwandeln, kennzeichnen oder
unangetastet lassen. Gemeinsam mit M3.3 zu klären, weil dort die Prüfung entsteht, die
sie sichtbar macht.

#### PROD-018 — Keine Verschlüsselung im Ruhezustand
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0003](../adr/0003-datenbank-und-datenhoheit.md)

**Zielzustand:** Verschlüsselte Speichervolumen, verschlüsselte Sicherungen, dokumentierte
Schlüsselverwaltung.

#### PROD-019 — Kein Sicherungs- und Wiederanlaufkonzept
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §15

Es existiert weder ein Sicherungsverfahren noch ein Nachweis, dass eine
Wiederherstellung funktioniert.

**Zielzustand:** Automatisierte Sicherung mit definierten Wiederherstellungszielen
(RPO/RTO), **regelmäßig geprüfte** Wiederherstellung. Eine ungeprüfte Sicherung ist keine
Sicherung.

#### PROD-020 — Kein Aufbewahrungs- und Löschkonzept
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §13, §15

Die Plattform verarbeitet personenbezogene Daten (Antragsteller, Kommentare,
Auditeinträge). Es existiert kein Konzept für Aufbewahrungsfristen, Auskunft, Berichtigung
und Löschung.

**Zielzustand:** Dokumentiertes Konzept einschließlich der Frage, wie sich Löschung mit
der in §16 geforderten lückenlosen Auditierung verträgt – ein Zielkonflikt, der bewusst
aufzulösen ist.

> **Erweitert am 2026-08-06 durch [ADR-0017](../adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) Punkt B10.**
> Neben der Versionshistorie entsteht ein zweiter dauerhafter Speicher: die abgewiesenen
> Schreiboperationen. Er wächst bei festgehaltenen Feldern mit jedem automatischen Lauf,
> auch wenn sich nichts ändert, und enthält Werte aus Fremdsystemen – damit möglicherweise
> personenbezogene Daten, deren Übernahme wir gerade **nicht** gewollt haben. Das
> Aufbewahrungskonzept muss ihn eigenständig behandeln; die Frist der Versionshistorie
> passt hier nicht ungeprüft.

> **Verschärft am 2026-08-05 durch [ADR-0012](../adr/0012-vollstaendige-versionierung-mit-zeitbezug.md).**
> Die Plattform hält künftig **jede Version jedes Datensatzes** vor, und Löschungen sind
> ausdrücklich fachlich statt physisch – Voraussetzung dafür, den Bestand zu einem
> vergangenen Zeitpunkt nachweisen zu können.
>
> Damit ist der Konflikt kein Randfall mehr, sondern strukturell: Eine Löschpflicht
> verlangt das Entfernen personenbezogener Daten, die Nachweispflicht das Erhalten des
> fachlichen Zustands. Ein tragfähiger Ansatz ist die **Anonymisierung personenbezogener
> Felder in der Historie unter Erhalt der fachlichen Mengen und Zeitpunkte** – zu prüfen
> und zu entscheiden, nicht nebenbei umzusetzen.
>
> Der Speicherbedarf wächst zudem mit jeder Änderung um eine vollständige Zeilenkopie.
> Aufbewahrungsfristen und eine Verdichtung alter Versionen gehören in dasselbe Konzept.

#### PROD-021 — Datenbankrechte noch nicht minimal
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §8 · **Fundstelle:** `infra/local/postgres/init/01-databases.sql`

Die Servicerollen sind Eigentümer ihrer Datenbanken und dürfen dort alles, einschließlich
Schemaänderungen zur Laufzeit.

**Zielzustand:** Trennung zwischen Migrationsrolle (Schemaänderung) und Laufzeitrolle
(nur Datenzugriff). Damit kann eine kompromittierte Anwendung das Schema nicht verändern.

---

## E – Container und Lieferkette

#### PROD-022 — Images sind über Tags statt Prüfsummen festgelegt
**Schwere:** Hoch · **Status:** ~~Offen~~ **Erledigt (2026-08-06)** · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, `.github/workflows/ci.yml`

Sämtliche Container-Images hingen an veränderlichen Tags. Der Inhalt eines Tags kann vom
Anbieter jederzeit ausgetauscht werden.

**Umgesetzt:** Alle sechs Images liegen auf `name:tag@sha256:…` – drei in der
Compose-Datei (PostgreSQL, Keycloak, keycloak-config-cli) und drei in der Pipeline
(Trivy, actionlint, oasdiff). Der Tag bleibt als Beschriftung stehen, die Prüfsumme
entscheidet.

Der Schritt „Laufzeit-Images pruefen" leitet seine Liste über
`docker compose config --images` ab und übernimmt die Prüfsummen dadurch von selbst.

**Zur Trivy-Zeile `latest@sha256:…`:** Der Widerspruch ist nur scheinbar. Die
Schwachstellendatenbank wird zur Laufzeit geladen (`mirror.gcr.io/aquasec/trivy-db`), nicht
im Abbild mitgeliefert – die Festlegung friert also das Programm ein, nicht die Befunde.
Eine feste Versionsnummer statt `latest` wäre der nächste Schritt und wird von Renovate
ohnehin vorgeschlagen.

**Nicht abgedeckt:** Eine Prüfsumme belegt „dasselbe Abbild wie zuvor", nicht „das Abbild
des Herstellers". Dafür braucht es Signaturprüfung beim Ausrollen – siehe PROD-026.

#### PROD-023 — Container laufen als root, Dateisystem beschreibbar
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation:
false`, alle Capabilities entzogen.

#### PROD-024 — Keine Ressourcenbegrenzungen
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §15

Ohne Begrenzung kann ein einzelner Dienst den Knoten erschöpfen.

**Zielzustand:** Angeforderte und maximale Werte für CPU und Speicher je Dienst.

#### PROD-025 — Sicherheits-Scanning nur teilweise wirksam
**Schwere:** Kritisch · **Status:** In Arbeit · **Betrifft:** §13 · **Fundstelle:** `.github/workflows/ci.yml`, Job `security`

§13 fordert Abhängigkeits-Scanning, Container-Scanning (Trivy) sowie SAST und DAST in
CI/CD.

*Stand 2026-08-04:* Die Pipeline existiert und der Job ist grün – **aber weitgehend
gegenstandslos.** Der Geheimnis-Scanner erkennt nur bekannte Geheimnis-Formate
(Zugangsschlüssel, Token, private Schlüssel) und schlägt bei schwachen Passwörtern wie
`POSTGRES_PASSWORD: postgres` bewusst nicht an. `trivy config` unterstützt Docker Compose
nicht als Zieltyp; ein Dockerfile oder Kubernetes-Manifest existiert noch nicht. Geprüft
werden derzeit faktisch nur die Abhängigkeiten aus `pnpm-lock.yaml`.

Grün bedeutet hier also „nichts zu prüfen gefunden", nicht „sicher". Diese Unterscheidung
ist festzuhalten, weil ein grüner Sicherheitsjob sonst Vertrauen ohne Grundlage erzeugt.

**Zielzustand:**
1. Container-Image-Prüfung der eingesetzten Images (sofort möglich)
2. `trivy config` wird mit dem ersten Dockerfile in M1 wirksam
3. SAST, sobald Anwendungscode existiert (M1)
4. DAST gegen eine laufende Instanz (ab M2)

#### PROD-036 — GitHub-Actions nicht auf Commit-Prüfsumme festgelegt
**Schwere:** Hoch · **Status:** ~~Offen~~ **Erledigt (2026-08-06)** · **Betrifft:** §13 · **Fundstelle:** `.github/workflows/ci.yml`

Aktionen wurden über veränderliche Tags (`@v7`) eingebunden. Wer das Tag im
Quell-Repository verschiebt, führt beliebigen Code in unserer Pipeline aus – mit Zugriff
auf deren Berechtigungen und Geheimnisse. Das ist ein realer, mehrfach ausgenutzter
Angriffsweg auf Lieferketten.

**Umgesetzt:** Alle zehn Einbindungen liegen auf der vollständigen Commit-Prüfsumme, mit
der Versionsangabe als Kommentar dahinter. `renovate.json` enthält
`helpers:pinGitHubActionDigests`, sodass auch künftig hinzukommende Aktionen automatisch
festgelegt und Prüfsummen samt Kommentar aktualisiert werden.

Die Reihenfolge war beabsichtigt: erst Renovate in Betrieb nehmen, dann festlegen. Ohne
automatische Aktualisierung veralten Prüfsummen unbemerkt, und dann ist die Festlegung
schlechter als ein Tag.

**Offen geblieben:** `permissions:` ist auf Arbeitsablauf-Ebene bereits auf
`contents: read` begrenzt; eine feinere Begrenzung je Job ist noch nicht erfolgt.

#### PROD-037 — Basis-Image-Schwachstellen unterdrückt
**Schwere:** Hoch · **Status:** Bewusst akzeptiert (befristet) · **Betrifft:** §13 · **Fundstelle:** `.trivyignore.yaml`

Der Image-Scan meldet 16 Befunde in `postgres:18-alpine`, die wir nicht selbst beheben
können. Sie sind in `.trivyignore.yaml` **befristet** unterdrückt.

**Gruppe 1 – `gosu`, 15 Befunde (1 kritisch, 14 hoch), Ablauf 2026-11-04.**
Alle betreffen die Go-Standardbibliothek 1.24.6, mit der das Binärprogramm gebaut wurde:
`crypto/tls`, `crypto/x509`, `net/url`, `net/mail`, `net`, `mime`, HTTP/2.

`gosu` löst im Postgres-Entrypoint Benutzer- und Gruppenrechte auf und führt danach den
eigentlichen Prozess aus. Es öffnet keine Netzwerkverbindung und verarbeitet weder TLS,
Zertifikate, URLs, MIME noch E-Mail-Adressen – **keiner der betroffenen Codepfade ist
erreichbar.** Trivy meldet sie strukturell: Bei Go-Binärprogrammen wird die Version der
Standardbibliothek ausgewertet, nicht die tatsächlich genutzten Pakete. Das betrifft jedes
Go-Binärprogramm gleichermaßen.

Gesondert geprüft: CVE-2026-39822 (`os.Root`, Verzeichnisdurchquerung). `os.Root` wurde
erst mit Go 1.24 eingeführt und wird von gosu nicht verwendet.

**Gruppe 2 – `c-ares` CVE-2026-33630 (hoch), Ablauf 2026-09-04.**
Anders gelagert: real behebbar. Der Fix (`1.34.8-r0`) liegt vor, das Basis-Image wurde
nur noch nicht neu gebaut. Deshalb die kurze Frist – hier ist ein Image-Update die
Lösung, keine dauerhafte Bewertung.

**Wirksamkeit geprüft (2026-08-04):** `trivy image --show-suppressed` weist alle
16 Einträge als `ignored` mit ihrer jeweiligen Begründung und der Quelle
`/src/.trivyignore.yaml` aus; das Image meldet 0 offene Befunde. Der `paths`-Filter auf
`usr/local/bin/gosu` greift wie vorgesehen.

`--show-suppressed` ist damit auch das Mittel der Wahl, um bei künftigen Einträgen zu
prüfen, ob sie tatsächlich greifen – eine Unterdrückung, die ins Leere läuft, sieht im
Bericht genauso aus wie ein Befund, den es nicht gibt.

### Verfahren für Unterdrückungen

Verbindlich für jeden Eintrag in `.trivyignore.yaml`:

1. **`statement`** – warum der Befund im konkreten Verwendungskontext nicht trägt. „Nicht
   behebbar" genügt nicht; erforderlich ist die Aussage, warum er nicht ausnutzbar ist
   oder welcher Weg zur Behebung führt.
2. **`expired_at`** – Pflicht, ohne Ausnahme. Nach Ablauf wird der Build wieder rot und
   erzwingt eine Neubewertung.
3. **`paths` oder `purls`** – so eng wie möglich eingegrenzt. Eine Unterdrückung nur über
   die CVE-Kennung gilt für das gesamte Repository und würde denselben Befund in einem
   anderen, sehr wohl betroffenen Bestandteil ebenfalls verbergen.

Fristen als Richtwert: behebbare Befunde ein Monat, strukturell nicht erreichbare drei
Monate. Längere Fristen brauchen eine eigene Begründung im `statement`.

**Ein abgelaufener Eintrag wird nicht verlängert, sondern neu bewertet.** Verlängerung
ohne erneute Prüfung ist genau der Mechanismus, mit dem Unterdrückungen dauerhaft werden.

### Die entscheidende Unterscheidung

> **„Wir sind nur nicht aktuell" ist niemals ein Grund für eine Unterdrückung.**

Ein Befund darf ausschließlich dann unterdrückt werden, wenn der betroffene Codepfad im
konkreten Verwendungskontext **nicht erreichbar** ist. Ist eine behobene Fassung
verfügbar und wir setzen sie schlicht noch nicht ein, ist die Antwort das Update – auch
wenn es unbequem ist.

Der Lauf vom 2026-08-04 hat beide Fälle nebeneinander geliefert und zeigt den Unterschied
deutlich:

| | `gosu` (postgres) | Keycloak 26.4.7 |
|---|---|---|
| Befunde | 15 (Go-Standardbibliothek) | 62 (11 Betriebssystem, 51 Java) |
| Betroffene Pfade | `crypto/tls`, `net/url`, `net/mail` … | OIDC-Anmeldung, Token-Ausgabe, Scope-Durchsetzung, `redirect_uri`-Prüfung |
| Erreichbar? | **Nein** – gosu tut nichts davon | **Ja** – das ist die Kernfunktion des Dienstes |
| Behandlung | Befristet unterdrückt, begründet | **Aktualisiert** auf 26.7.0 |

Die Keycloak-Befunde umfassten unter anderem Rechteausweitung über gefälschte
Autorisierungscodes (CVE-2026-4282), Session Fixation im OIDC-Anmeldefluss
(CVE-2026-7507) und die Umgehung der `redirect_uri`-Prüfung (CVE-2026-3872) – in genau
dem Dienst, auf dem die Authentifizierung der gesamten Plattform beruht. Eine
Unterdrückung wäre hier nicht vertretbar gewesen, unabhängig von der Begründung.

**Wenn die Unterscheidung im Einzelfall unklar ist, gilt sie als erreichbar.**

### Die dritte Kategorie: Upstream hat noch nicht nachgezogen

Es gibt einen Fall zwischen beiden: Wir setzen bereits die **neueste verfügbare Fassung**
eines Fremdbestandteils ein, und diese bündelt eine Bibliothek, für die zwar ein Fix
existiert, den der Hersteller aber noch nicht übernommen hat. Ein Update ist unmöglich –
es gibt nichts, worauf.

Das ist **keine** Unerreichbarkeit und darf nicht als solche dokumentiert werden.
Es ist eine **befristete Risikoannahme** und wird als solche behandelt:

- Status `Bewusst akzeptiert (befristet)` mit eigenem Eintrag, nicht nur eine Zeile in
  `.trivyignore.yaml`
- Frist gekoppelt an die **nächste Herstellerfassung**, nicht an ein rundes Datum
- Im `statement` steht ausdrücklich „Risiko akzeptiert, Upstream ausstehend" – nicht
  „nicht erreichbar"
- Bei Schweregrad `Kritisch` gilt die Regel aus der Legende: **nicht akzeptierbar.** Dann
  ist der Fremdbestandteil selbst infrage zu stellen.

Der Unterschied ist nicht sprachlicher Natur. „Nicht erreichbar" heißt: Der Befund geht
uns nichts an. „Risiko akzeptiert" heißt: Er geht uns etwas an, und wir tragen ihn
bewusst für eine begrenzte Zeit.

#### PROD-038 — Von Keycloak gebündelte Bibliotheken mit offenen Schwachstellen
**Schwere:** Hoch · **Status:** Bewusst akzeptiert (befristet) · **Betrifft:** §13 · **Fundstelle:** `.trivyignore.yaml`

Keycloak 26.7.1 – die zum 2026-08-07 neueste Fassung – bündelt Bibliotheken mit bekannten
Schwachstellen. Ein Update ist nicht möglich; die Fixes liegen in Bibliotheksfassungen,
die Keycloak noch nicht übernommen hat.

> **Aktualisiert am 2026-08-07 von 26.7.0 auf 26.7.1.** Anlass war ein Trivy-Befund zu
> `micrometer-core` (CVE-2026-40983, CVE-2026-40984, beide HOCH, DoS). Das Upgrade behebt
> ihn **nicht** – beide Fassungen verwenden Quarkus 3.33.2.1 und damit dieselbe
> Micrometer-Fassung 1.16.3; die Fixes liegen in 1.16.6 beziehungsweise 1.15.12.
>
> **Der eigentliche Ertrag lag woanders.** Die Prüfung des Upgradepfads brachte zutage,
> dass 26.7.1 ein Sicherheitsrelease mit **fünf Keycloak-eigenen CVEs** ist – darunter
> Rechteausweitung über Rollenmapper-Injektion (CVE-2026-4629) und die Umgehung von
> `requestObjectSignatureAlg` per JWE (CVE-2026-9793). Diese wiegen deutlich schwerer als
> der Auslöser und wären ohne ihn nicht aufgefallen.
>
> **Daraus die Lehre für dieses Verfahren:** Ein Befund ist ein Anlass, den Upgradepfad
> insgesamt anzusehen – nicht nur zu prüfen, ob er genau diesen Befund schließt. Die Frage
> „behebt das Update meinen Fehlschlag?" hätte hier zu einem Nein und damit zum Verzicht
> auf das Upgrade geführt.

**Nicht erreichbar (7)** – Begründungen je Eintrag in `.trivyignore.yaml`:
CVE-2025-59250 (MS-SQL-Treiber wird nie geladen, zudem Vergleichsartefakt bei der
`jre11`-Kennung), CVE-2026-55831/-55833/-56745 (SPDY-Codec, nicht verwendet),
CVE-2026-55851 (PROXY-Protokoll abgeschaltet), CVE-2026-59901 (bzip2 im HTTP-Stack nicht
verwendet), CVE-2026-54291 (setzt TLS-Kanalbindung voraus, siehe unten).

**Risiko akzeptiert, Upstream ausstehend (4):**
CVE-2026-54512 und CVE-2026-54513 (jackson-databind, Codeausführung über Umgehung des
`PolymorphicTypeValidator`), GHSA-r7wm-3cxj-wff9 (jackson-core),
CVE-2026-56819 (Netty, Speicherleck über HTTP/2-DATA-Frames – Keycloak bedient HTTP/2,
also erreichbar).

**Überprüfung:** Mit der nächsten Keycloak-Fassung, spätestens 2026-09-15. Renovate meldet
neue Fassungen als Pull Request.

**Kopplung zu PROD-004:** CVE-2026-54291 (Downgrade des Man-in-the-Middle-Schutzes bei
SCRAM-SHA-256-PLUS) ist derzeit gegenstandslos, weil die Datenbankverbindung
unverschlüsselt läuft. **Mit der Umsetzung von PROD-004 wird er relevant** und ist dann
neu zu bewerten – die Behebung des einen Punktes aktiviert den anderen.

**Einordnung:** Alle Befunde betreffen ausschließlich die lokale Entwicklungsumgebung. Vor
einem Produktivgang greift ohnehin `PROD-025`; diese Liste ist die Voraussetzung dafür,
dass die Bewertung dann auf einer gepflegten Grundlage steht statt bei null zu beginnen.

#### PROD-039 — Werkzeug-Images blockieren die Pipeline nicht
**Schwere:** Mittel · **Status:** Bewusst akzeptiert · **Betrifft:** §13 · **Fundstelle:** `.github/workflows/ci.yml`, Job `security`

Der Image-Scan unterscheidet zwei Klassen:

| Klasse | Ermittlung | Verhalten |
|---|---|---|
| **Laufzeit** – PostgreSQL, Keycloak | `docker compose config --images` | Befund bricht den Build |
| **Werkzeug** – keycloak-config-cli | zusätzlich im Profil `config` | Befund wird berichtet, blockiert nicht |

**Begründung.** Werkzeug-Images werden nie ausgerollt. `keycloak-config-cli` läuft rund
eine Sekunde lokal und in der CI, nimmt keine Verbindungen an und verarbeitet
ausschließlich die eigene Realm-Datei aus diesem Repository. Das reale Lieferkettenrisiko
daran ist ein **manipuliertes Image**, und dagegen hilft die Festlegung auf einen Digest
(`PROD-022`), nicht die CVE-Prüfung.

Der ausschlaggebende Grund ist aber ein praktischer: Bei gleicher Behandlung kämen
19 weitere Unterdrückungen hinzu – zusammen über 45. Ab dieser Größe wird die Liste nicht
mehr gepflegt, und dann ist das gesamte Verfahren wertlos. Ein Tor, das für alles gilt,
gilt am Ende für nichts.

**Was das nicht bedeutet:** Werkzeug-Images werden weiterhin gescannt, und die Befunde
stehen im Protokoll. Ein Befund, der auf dem **Eingabepfad** eines Werkzeugs liegt oder
Codeausführung ermöglicht, wird einzeln bewertet – siehe PROD-040.

**Überprüfung:** Sobald ein Werkzeug-Image in einer nicht-lokalen Umgebung eingesetzt
wird, entfällt diese Einstufung sofort.

#### PROD-040 — Spring Boot 3.4.5 in keycloak-config-cli, CVE-2026-40973
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Fundstelle:** `infra/local/compose.yaml`, Dienst `keycloak-config`

`adorsys/keycloak-config-cli:6.5.1-26` bündelt Spring Boot 3.4.5. CVE-2026-40973
beschreibt „Arbitrary Code Execution and Session Hijacking via predictable …"; behoben in
3.5.14 bzw. 4.0.6.

**Warum dieser Befund gesondert steht**, obwohl Werkzeug-Images nach PROD-039 nicht
blockieren: Der Ausnutzungspfad ließ sich aus der Kurzbeschreibung nicht bestimmen.
„Session Hijacking" deutet auf einen Webserver-Kontext, den ein Kommandozeilenwerkzeug
nicht hat – „Arbitrary Code Execution via predictable" dagegen auf vorhersagbare temporäre
Dateien, was jede Spring-Boot-Anwendung betreffen kann.

Erschwerend: Das Werkzeug hält **Keycloak-Administratorzugangsdaten**. Codeausführung in
diesem Prozess bedeutet Zugriff auf die Identitätsverwaltung.

**Zu tun:**
1. Ausnutzungspfad anhand der vollständigen Empfehlung klären
2. Ist er in einem kurzlebigen CLI ohne Webserver nicht gegeben → Umstufung auf
   `Bewusst akzeptiert` mit Begründung
3. Andernfalls: neuere `keycloak-config-cli`-Fassung mit Spring Boot ≥3.5.14 suchen oder
   das Werkzeug ersetzen

**Bis zur Klärung gilt der Befund als erreichbar** – gemäß der Auffangregel im Verfahren.
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13

**Zielzustand:** SBOM je Image, signierte Images, Prüfung der Signatur beim Ausrollen.

---

## F – Betrieb und Verfügbarkeit

#### PROD-027 — Keycloak ohne Hochverfügbarkeit
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §15 · **Verweis:** [ADR-0004](../adr/0004-authentifizierung-und-autorisierung.md)

Keycloak ist eine zentrale Abhängigkeit. Fällt es aus, ist die gesamte Plattform nicht
nutzbar.

**Zielzustand:** Mehrere Instanzen mit verteiltem Sitzungs-Cache, Token-Zwischenspeicher
in den Services, definiertes Verhalten bei nicht erreichbarem Identitätsanbieter.

#### PROD-028 — PostgreSQL ohne Replikation
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §15

**Zielzustand:** Replikation mit automatischem Failover, Wiederherstellung auf einen
Zeitpunkt.

#### PROD-029 — `/health` meldet Bereitschaft ohne sie zu prüfen
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §14 · **Fundstelle:** `services/requirement/src/health/`

**Zielzustand:** Getrennte Endpunkte für Lebendigkeit und Bereitschaft je Service; die
Bereitschaft berücksichtigt Datenbank- und Identitätsanbieter-Erreichbarkeit.

> **Präzisiert am 2026-08-06.** Der vorhandene Endpunkt antwortet **immer** mit
> `{status: "ok"}` – unabhängig davon, ob die Datenbank oder Keycloak erreichbar sind.
>
> Damit ist er als Bereitschaftsprüfung nicht nur unvollständig, sondern **irreführend**:
> Die Orchestrierungsschicht leitet Verkehr auf einen Dienst, der keine einzige fachliche
> Anfrage beantworten kann. Ein fehlender Endpunkt wäre ehrlicher als einer, der
> ungeprüft „bereit" meldet.
>
> Aufgefallen über `redocly lint` (`operation-4xx-response`): Ein Vorgang ohne jede
> 4xx- oder 5xx-Antwort ist bei einer Bereitschaftsprüfung ein Widerspruch in sich.
>
> **Zu tun:** `@nestjs/terminus` mit Prüfungen auf Datenbank und JWKS-Endpunkt;
> Bereitschaft liefert 503, wenn eine Abhängigkeit fehlt. Lebendigkeit bleibt davon
> getrennt und prüft nur den Prozess.

#### PROD-030 — Keine Dienstgüteziele definiert
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §15

§15 fordert definierte SLOs. Ohne sie ist weder Alarmierung noch Kapazitätsplanung für
die Plattform selbst möglich.

#### PROD-031 — Keine Beobachtbarkeit
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §14 · **Geplant:** M1

§14 fordert OpenTelemetry, Prometheus, Grafana und Loki. Zusätzlich fehlt eine
Alarmierung für sicherheitsrelevante Ereignisse – fehlgeschlagene Anmeldungen,
Berechtigungsverweigerungen, ungewöhnliche Service-Account-Aktivität (§13).

> **Ergänzt am 2026-08-07.** Die Metriken von Keycloak sind seither abgeschaltet
> (`KC_METRICS_ENABLED=false`). Sie wurden von nichts abgeholt und aktivierten die
> HTTP-Instrumentierung von `micrometer-core`, deren offene DoS-Schwachstellen
> CVE-2026-40983 und CVE-2026-40984 **kein Keycloak-Update behebt** – Micrometer kommt
> über die Abhängigkeitsliste von Quarkus, und 26.7.0 wie 26.7.1 verwenden 3.33.2.1.
>
> **Beim Aufbau der Beobachtbarkeit sind beide Einträge neu zu bewerten**, bevor die
> Metriken wieder eingeschaltet werden. Die Abschaltung ist eine Minderung, keine
> Behebung – sie ist in `.trivyignore.yaml` deshalb bewusst unter „Risiko akzeptiert"
> geführt und nicht als Unerreichbarkeit.

#### PROD-042 — Der Realm ist ein gemeinsamer Ausfallbereich
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §15 · **Verweis:** [ADR-0015](../adr/0015-mehrere-identitaetsquellen.md)

ADR-0015 bündelt sämtliche Identitätsquellen in einem Realm. Das ist für die Eindeutigkeit
der Identität richtig und für die Verfügbarkeit die schlechtere Wahl: Fällt Keycloak aus,
kann sich **niemand** mehr anmelden – auch nicht die Anwender, deren Verzeichnis
einwandfrei läuft. Ohne die Bündelung wäre der Ausfall auf einen Mandanten begrenzt.

Verschärfend kommt hinzu, dass nach ADR-0014 auch jede Tokenerneuerung über Keycloak
läuft. Ein Ausfall trifft damit nicht nur neue Anmeldungen, sondern beendet nach und nach
auch alle laufenden Sitzungen.

**Zielzustand:** Keycloak im Verbund über mehrere Verfügbarkeitszonen, Datenbank
hochverfügbar, definiertes SLO abgestimmt mit `PROD-030`. Der Ausfall der
Identitätsverwaltung ist als eigenes Szenario zu üben, nicht als Randfall des
Datenbankausfalls mitzubehandeln.

---

## G – Anwendungssicherheit

#### PROD-052 — Workflows sind konfigurierbar, aber sie gelten noch nicht
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §7 · **Fundstelle:** `services/requirement/src/workflows/`, `services/requirement/src/requirements/`

Seit M4.1 lassen sich Workflow-Definitionen anlegen, ändern und versionieren. Ein
Administrator legt Zustände, Übergänge und Endzustände fest, die Oberfläche zeigt sie an,
der Graph wird auf Widersprüche geprüft.

**Durchgesetzt wird davon nichts.** `requirement.status` ist weiterhin eine freie
Zeichenkette, die über `PATCH /v1/requirements/{id}` auf jeden beliebigen Wert gesetzt
werden kann – auch auf einen, den der Graph nicht kennt, und ohne den vorgesehenen
Übergang zu nehmen. Der Workflow beschreibt heute, er entscheidet nicht.

**Das ist gefährlicher als gar kein Workflow.** Ein konfigurierter Ablauf mit
Genehmigungsschritten erweckt den Eindruck, dass diese Schritte erzwungen werden. §7 sieht
ausdrücklich Vier-Augen-Prinzip und Genehmigungen an Übergängen vor; wer den Graphen in
der Verwaltungsoberfläche sieht, hat keinen Anlass zu vermuten, dass er umgangen werden
kann. Ein fehlendes Merkmal fällt auf, ein wirkungsloses nicht.

**Zielzustand:** M4.2 macht den Statuswechsel zu einem eigenen Vorgang und entfernt
`status` aus dem allgemeinen Schreibpfad; M4.3 ergänzt die Bedingungen an den Übergängen.
**Bis dahin darf kein Betrieb mit echten Genehmigungsanforderungen stattfinden** – auch
kein Pilotbetrieb, weil gerade dort die Annahme entstünde, die Genehmigung sei belegt.

Offen bleibt dabei, was ein Anforderungstyp **ohne** gültigen Workflow bedeutet: jeden
Wechsel zulassen oder jeden verweigern. Beides ist vertretbar, aber es muss entschieden
und nicht nebenbei implementiert werden.

> **Teilweise geschlossen am 2026-08-11 mit M4.2.**
>
> Umgesetzt: `status` ist aus `POST` und `PATCH` entfernt, der Wechsel läuft über einen
> eigenen Vorgang gegen den Zustandsgraphen, der Anfangszustand kommt aus der Definition,
> und ohne gültigen Workflow entsteht keine Anforderung
> ([ADR-0022](../adr/0022-statuswechsel-als-eigener-vorgang.md)). Die oben offene Frage ist
> damit entschieden: Kein Workflow heißt keine Anforderung – nicht „jeder Wechsel erlaubt".
>
> **Offen bleibt der Kern des Eintrags.** Der Graph erzwingt die **Reihenfolge**, nicht die
> **Zuständigkeit**: Jeder angemeldete Benutzer kann jeden Übergang auslösen, den der Graph
> hergibt. §7 verlangt an Übergängen benötigte Berechtigungen, Pflichtfelder und das
> Vier-Augen-Prinzip; das kommt mit M4.3.
>
> Die Schwere bleibt **Hoch**. Ein Ablauf, der die Reihenfolge erzwingt und die
> Zuständigkeit nicht, sieht einer Genehmigungsstrecke ähnlicher als vorher – und ist
> weiterhin keine. Die Verwechslungsgefahr ist damit eher gestiegen als gesunken.

#### PROD-049 — Das Tor für inkompatible Änderungen sieht nur das Schema
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §12 · **Fundstelle:** `.github/workflows/ci.yml`, Job `lint`, Schritt „Inkompatible Contract-Aenderungen pruefen"

`oasdiff` vergleicht den OpenAPI-Contract. Es erkennt entfernte Felder, verengte Typen und
verschwundene Endpunkte. **Es erkennt keine Verschärfung der Laufzeitprüfung bei
unverändertem Schema.**

Aufgefallen in M3.1: `sourceSystem` ist im Contract weiterhin `string` mit `maxLength`.
Seither wird der Wert zusätzlich gegen die Herkunftsregistratur geprüft
([ADR-0017](../adr/0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) A4). Ein
Client, der bisher einen beliebigen Wert schickte, erhält jetzt 400 – für ihn eine
inkompatible Änderung. Das Tor blieb grün, und zwar zu Recht: Am Schema hat sich nichts
geändert.

**Heute ohne Wirkung**, weil außer dem eigenen Frontend kein Konsument existiert. Der
Eintrag steht hier, weil §12 versionierte Schnittstellen mit Kompatibilitätsgarantie
verlangt – und ein Tor, das eine Zusicherung nur teilweise abdeckt, ist gefährlicher als
gar keines: Es erzeugt Vertrauen für den Bereich, den es nicht prüft.

> **Zweiter Fall am 2026-08-07 mit M3.3.** `dynamicAttributes` nahm bisher jeden Inhalt
> an. Seither werden Schlüssel abgewiesen, für die keine Attributdefinition gilt (§6).
> Im Contract steht dort unverändert `type: object, additionalProperties: true` – das
> Schema **kann** die Einschränkung gar nicht ausdrücken, weil die Definitionen zur
> Laufzeit gepflegt werden. `oasdiff` blieb erneut grün.
>
> **Zweimal derselbe Vorgang innerhalb von zwei Meilensteinen** – das ist kein Zufall,
> sondern die Regel bei einer Plattform, deren Datenmodell Fachdatum ist. Je mehr §6
> greift, desto mehr Zusicherungen liegen außerhalb dessen, was ein Schemavergleich
> sehen kann. Der Zielzustand unten ist damit dringlicher als bei seiner Aufnahme
> angenommen.

> **Dritter Fall am 2026-08-11 mit M4.2 – und diesmal andersherum.** `status` wurde aus
> `POST /v1/requirements` und aus `PATCH …/by-source/…` entfernt (ADR-0022). `oasdiff`
> stuft das als **`warning`** ein, nicht als `error`; mit `--fail-on ERR` wäre die
> Änderung durch das Tor gegangen.
>
> Für einen gewöhnlichen Dienst ist die Einstufung richtig: Ein entferntes
> Anfrageschema-Feld wird üblicherweise ignoriert, der alte Client läuft weiter. **Bei uns
> nicht.** `forbidNonWhitelisted: true` in `app.setup.ts` macht daraus eine 400 – ein
> Client, der `status` weiter mitschickt, bekommt gar nichts mehr gespeichert. Die
> Einstellung ist bewusst so gewählt (ein verworfenes Feld hielte der Aufrufer für
> übernommen) und steht nirgends im Schema.
>
> Rot war der Lauf aus einem anderen Grund: Beim Entfernen blieben die Dekoratoren von
> `status` stehen und hingen an `owner`, dessen `maxLength` dadurch von 200 auf 100 fiel.
> **Das Tor hat einen unbeabsichtigten Fehler gefunden und die beabsichtigte inkompatible
> Änderung durchgelassen.** Beides am selben Lauf.
>
> Die beiden ersten Fälle betrafen Verschärfungen bei unverändertem Schema. Dieser betrifft
> eine Schemaänderung, deren Tragweite von der Laufzeitkonfiguration abhängt. Die
> Prüfliste aus dem Zielzustand muss deshalb auch **entfernte Anfragefelder** enthalten,
> nicht nur zusätzliche Prüfungen.

**Zielzustand:** Verschärfungen der Laufzeitprüfung gelten als inkompatible Änderung und
sind wie Schemaänderungen zu behandeln – angekündigt, versioniert, im Änderungsprotokoll
vermerkt. Wo möglich, gehört die Einschränkung ins Schema, damit `oasdiff` sie sieht: eine
Aufzählung zulässiger Herkünfte ist allerdings gerade nicht möglich, weil die Registratur
zur Laufzeit gepflegt wird. Für solche Fälle braucht es eine Prüfliste im Review, keine
Automatisierung, die es nicht geben kann.

#### PROD-048 — Swagger-UI wird ungeschützt ausgeliefert
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §12, §13 · **Fundstelle:** `services/requirement/src/main.ts`, `SwaggerModule.setup("api-docs", ...)`

Der Service liefert unter `/api-docs` die Swagger-Oberfläche aus – ohne Authentifizierung,
in jeder Umgebung. Zwei Wirkungen:

- **Der vollständige Schnittstellenumfang ist öffentlich lesbar**, einschließlich der
  Felder, die nach §6 dynamisch sind. Wer angreift, muss nicht raten
- **Swagger-UI ist eine ausgelieferte Fremdanwendung im Browser.** Sie läuft auf dem
  Ursprung des Service und hatte wiederholt Cross-Site-Scripting-Schwachstellen

Das ist kein Argument gegen die Dokumentation selbst: Der Contract ist eingecheckt, wird
mit `redocly lint` geprüft und über den Abweichungstest abgesichert
([ADR-0005](../adr/0005-api-first-workflow.md)). §12 verlangt eine dokumentierte
Schnittstelle, nicht eine vom Service gehostete Oberfläche.

Zur Auslieferung ist `@fastify/static` erforderlich – eine Abhängigkeit, die
ausschließlich für diesen Zweck im Baum liegt. Der Fehler `The "@fastify/static" package
is missing` beim Start ist die Folge davon, dass die Oberfläche eingerichtet, das Paket
aber nicht deklariert war.

**Zielzustand:** Die Oberfläche ist in produktiven Umgebungen abgeschaltet oder hinter
Authentifizierung gestellt; entschieden über Konfiguration, nicht über einen zweiten
Codepfad. Das reine Dokument bleibt unter einem eigenen Pfad abrufbar, wenn §12 das
erfordert – dafür wird kein statischer Dateiversand gebraucht.

> Die Telemetriekomponente `@scarf/scarf`, die über `swagger-ui-dist` in den Baum kommt,
> ist bereits abgelehnt (`allowBuilds` in `pnpm-workspace.yaml`, siehe
> [tooling.md](../development/tooling.md)).

#### PROD-032 — Keine Begrenzung der Anfragerate
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §12, §13

§12 sieht öffentliche Lese-APIs vor. Ohne Begrenzung sind sie unmittelbar für
Überlastung und massenhaftes Auslesen offen.

**Zielzustand:** Begrenzung je API-Client und je Identität, am Ingress und zusätzlich im
Service.

#### PROD-041 — Zugriffstoken liegt im Browser
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Entscheidung fällig:** M2 · **Verweis:** [ADR-0013](../adr/0013-frontend-zuschnitt-und-zugriffsweg.md)

Nach ADR-0013 spricht der Browser die Service-APIs direkt an. Das Frontend hält damit das
Zugriffstoken selbst – und dieses trägt die Zielgruppen **aller** aufgerufenen Services.

**Folge:** Ein erfolgreicher XSS-Angriff im Frontend liefert ein Token für die gesamte
Plattform, nicht nur für den betroffenen Bereich. Eine Content Security Policy
(`PROD-033`) senkt die Wahrscheinlichkeit, schließt die Lücke aber nicht – eine anfällige
Abhängigkeit im Frontend genügt.

**Die Alternative** ist das Backend-for-Frontend-Muster: Das Token bleibt serverseitig,
der Browser erhält ausschließlich ein `httpOnly`-Sitzungscookie. Ein Angreifer im
Browser kann dann kein Token entwenden, weil dort keines liegt.

**Das ist der einzige Punkt, an dem eine vorgelagerte Schicht nicht bequemer, sondern
sicherer ist.** Alle übrigen Vorteile eines Gateways – zentrale Policy, Aggregation,
Ratenbegrenzung – sind Betriebs- und Wartungsfragen; diese hier ist eine
Sicherheitsfrage.

> **Entschieden am 2026-08-06: Backend-for-Frontend**
> ([ADR-0014](../adr/0014-frontend-authentifizierung-ueber-bff.md)). Status damit
> **In Arbeit** – die Umsetzung erfolgt in M2, der Eintrag schließt mit dem Anmeldefluss.
>
> **Wichtig für die Restbewertung:** Der BFF verhindert, dass Schadcode ein Token
> **entwendet**, nicht dass er die Sitzung **benutzt** – das Cookie wird bei jeder Anfrage
> automatisch mitgeschickt. `PROD-033` (Content Security Policy) bleibt deshalb
> erforderlich und darf nicht als erledigt gelten, weil dieser Eintrag es wird.

#### PROD-033 — Keine Sicherheitsheader im Frontend
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §13 · **Geplant:** M2

**Zielzustand:** Content Security Policy, `Strict-Transport-Security`,
`X-Content-Type-Options`, `Referrer-Policy`, restriktive `Permissions-Policy`.

#### PROD-034 — Fehlerantworten noch nicht auf Informationspreisgabe geprüft
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13 · **Verweis:** [ADR-0005](../adr/0005-api-first-workflow.md)

Das Fehlerformat nach RFC 9457 ist festgelegt, der Inhalt aber nicht. Stapelverfolgungen,
Datenbankfehler und interne Kennungen dürfen nicht nach außen gelangen.

**Zielzustand:** Einheitlicher Ausnahmefilter, der interne Details protokolliert und nach
außen ausschließlich Fehlerklasse und Vorgangskennung zurückgibt.

#### PROD-035 — Auditprotokoll nicht manipulationsgeschützt
**Schwere:** Hoch · **Status:** Offen · **Betrifft:** §16 · **Verweis:** [ADR-0007](../adr/0007-inkrementeller-aufbau-der-servicelandschaft.md)

Auditeinträge liegen zunächst in derselben Datenbank wie die Fachdaten und mit denselben
Rechten. Wer schreiben darf, kann sie verändern – womit sie als Nachweis wertlos wären.

**Zielzustand:** Nur-Anfügen-Rechte für die Laufzeitrolle, getrennte Aufbewahrung,
definierte Aufbewahrungsfrist. Zu klären gemeinsam mit PROD-020.

---

## Verwendung

**Vor jedem Produktivgang** wird diese Liste durchgegangen. Ein Eintrag mit Schwere
`Kritisch` und Status `Offen` blockiert den Produktivgang – ohne Ermessensspielraum.

**Beim Eintragen** wird die nächste freie Nummer vergeben und der Eintrag in den passenden
Bereich einsortiert. Die Zusammenfassungstabelle wird mitgeführt.

**Beim Schließen** wechselt der Status auf `Erledigt (JJJJ-MM-TT, <Commit oder PR>)`. Der
Eintrag bleibt stehen.

**Bei bewusster Annahme eines Risikos** wechselt der Status auf `Bewusst akzeptiert`, mit
Begründung, Entscheider und Überprüfungsdatum. Ein kritischer Eintrag kann nicht bewusst
akzeptiert werden.
