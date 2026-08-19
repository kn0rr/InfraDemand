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
| B – Geheimnisse und Zugangsdaten | 5 | 4 | **1** |
| C – Identität und Zugriff | 18 | 3 | **4** |
| D – Daten | 7 | 3 | – |
| E – Container und Lieferkette | 10 | 1 | **2** |
| F – Betrieb und Verfügbarkeit | 6 | 1 | – |
| G – Anwendungssicherheit | 10 | 1 | **3** |
| **Gesamt** | **63** | **18** | **10** |

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

#### PROD-058 — Die Verwaltungs-API von OPA ist unauthentifiziert und erlaubt das Ersetzen der Richtlinie
**Schwere:** Kritisch · **Status:** Offen · **Betrifft:** §8, §13 · **Verweis:** [ADR-0028](../adr/0028-policy-engine-opa-als-sidecar.md) · **Fundstelle:** `infra/local/compose.yaml`, Dienst `opa`

OPA startet ohne Zugriffsschutz auf seiner HTTP-Schnittstelle. Wer Port 8181 erreicht,
kann die Richtlinie **ersetzen** – nicht nur lesen. Nachgestellt am 2026-08-13 gegen
`openpolicyagent/opa:1.19.0`:

```
PUT /v1/policies/sichtbarkeit.rego     →  {} [HTTP 200]
```

Danach lieferte die Teilauswertung für einen Anwender **ohne jede Mandantenzugehörigkeit**
`{"result":{"query":{}}}` – unbedingtes Ja, also den gesamten Bestand. Ein HTTP-Aufruf
ohne Anmeldung hebt damit die vollständige Berechtigungsprüfung auf.

**Der schreibgeschützte Einhängepunkt schützt nicht.** `:ro` füttert OPA beim Start;
gehalten werden die Richtlinien im Speicher, und die API schreibt dorthin. Wer aus dem
`ro` einen Schutz abliest, liegt falsch – das ist der eigentliche Grund für diesen
Eintrag, denn die Konfiguration *sieht* abgesichert aus.

Zusätzlich gibt `GET /v1/policies` den vollständigen Quelltext aller geladenen Richtlinien
heraus. Für sich genommen weniger schwerwiegend, aber es legt die Genehmigungsstruktur
offen – dieselbe Erwägung wie bei `PROD-055`.

**Heute begrenzt**, weil OPA nur in der lokalen Umgebung läuft und der Port auf dem Rechner
des Entwicklers liegt. Der Eintrag steht hier, weil die Bewertung sich mit der ersten
gemeinsam genutzten Umgebung schlagartig ändert und die Voreinstellung dann unverändert
wäre.

### Behebung – nachgestellt und belegt

**Der wirksame Hebel ist `--authorization=basic` mit einer `system.authz`-Richtlinie.** Er
braucht kein Geheimnis, kein Netzwerkkonzept und keine nicht-lokale Umgebung – er ist
sofort setzbar. Gemessen am 2026-08-13 gegen `openpolicyagent/opa:1.19.0`, dieselben
Aufrufe wie oben:

| Aufruf | ohne authz | mit authz |
|---|---|---|
| `PUT /v1/policies/…` – Richtlinie ersetzen | 200, wirksam | **401** |
| `GET /v1/policies` – Quelltext aller Richtlinien | 200 | **401** |
| `PUT /v1/data/x` – Datendokument schreiben | 200 | **401** |
| `POST /v1/compile/anforderungen/sichtbarkeit/sichtbar` | 200 | **200**, Bedingung unverändert |
| `POST /v1/compile/grenzfaelle/alles` – nicht freigegeben | 200 | **401** |

Die letzte Zeile ist der Zugewinn über das Schließen der Lücke hinaus: Freigegeben ist
**ein** Auswertungspfad, nicht „Auswertung allgemein". Jede weitere Richtlinie muss
ausdrücklich aufgenommen werden.

**Bei fehlender authz-Richtlinie antwortet OPA auf allen Pfaden mit 500.** Also
fail-closed, aber mit einer irreführenden Fehlerklasse: Wer die Datei löscht, sieht keinen
Zugriffsfehler, sondern einen Serverfehler. Das ist die richtige Richtung und eine
schlechte Meldung.

Die Richtlinie steht in `services/requirement/policies/authz.rego`, wird also mit demselben
Einhängepunkt geladen und mit `opa test` geprüft wie die Fachrichtlinie. Sie kann sich nicht
selbst aushebeln – der Pfad zur Richtlinienverwaltung ist der erste, den sie abweist.

### Verbleibendes Risiko

Vier Punkte, die das geschlossene Tor **nicht** abdeckt:

1. **Die Freigabeliste kann verwässern.** Wer eine 401 als Störung empfindet und die Regel
   zu „alles unter `compile`" verbreitert, öffnet sämtliche Auswertungspfade.
   `test_fremder_auswertungspfad_ist_verboten` bricht genau dann – abgedeckt, aber nur
   deswegen.
2. **Es ist Pfadfilterung, keine Authentifizierung.** Wer den Port erreicht, darf den
   freigegebenen Pfad auswerten. Heute verrät das wenig. Ab M5.3 nimmt die Richtlinie
   Rollen, Projekte und Kostenstellen als Eingabe – dann ist der Endpunkt ein
   Auskunftsdienst über die Berechtigungslogik.
3. **Die irreführende Fehlermeldung** (500 statt 401) legt die falsche Reparatur nahe:
   `--authorization=basic` entfernen statt die Datei wiederherstellen. Danach funktioniert
   alles wieder – mit offener Lücke.
4. **Ein Austausch wäre nicht nachweisbar.** Es gibt keine Möglichkeit zu belegen, dass die
   laufende Richtlinie die aus dem Repository ist. Kein Einbruchs-, sondern ein
   Nachweisrisiko (§19.4). Die Antwort sind signierte Bundles, und die hängt an der
   vertagten Frage der Richtlinienverteilung.

### Frist – korrigiert am 2026-08-13

Ursprünglich stand hier „erst mit der ersten nicht-lokalen Umgebung". **Das ist die falsche
Marke.** Heute stehen die Guards aus M3.2 neben der Engine (ADR-0028 Punkt 6); eine
ausgetauschte Richtlinie wäre eine von zwei Prüfungen. Ab **M5.3** weichen die Guards, und
dann ist OPA die einzige. Das Risikoprofil dieser Komponente verschlechtert sich im Verlauf
des Meilensteins.

Maßgeblich ist deshalb, **was zuerst eintritt: die gemeinsam genutzte Umgebung oder der
Moment, in dem die Engine alleine trägt.**

**Zwei weitere Maßnahmen bleiben, fällig zum oben genannten Zeitpunkt:**

1. Der Sidecar hört auf `127.0.0.1` statt `0.0.0.0`. Im Pod erreicht der Dienst ihn über
   den geteilten Netzwerknamensraum; von außerhalb ist er dann nicht ansprechbar. **Lokal
   nicht möglich**, weil der Dienst dort außerhalb von Compose läuft und den Sidecar über
   den veröffentlichten Port erreicht – ein Container, der nur auf seiner Rückschleife
   hört, ist von außen nicht erreichbar. Deshalb lokal stattdessen die Portbindung an
   `127.0.0.1` auf der Wirtsseite.
2. Ein gemeinsames Merkmal zwischen Dienst und Sidecar, damit nicht jeder Nachbar im
   Netzwerknamensraum auswerten darf. Erst sinnvoll, wenn es eine Geheimnisverwaltung gibt
   (§13, Vault).

#### PROD-059 — Die Policy-Engine ist angebunden und entscheidet nichts
**Schwere:** Mittel · **Status:** **Erledigt mit M5.3 (2026-08-14)** · **Betrifft:** §8 · **Verweis:** [ADR-0028](../adr/0028-policy-engine-opa-als-sidecar.md) Punkt 6, [ADR-0029](../adr/0029-zuschnitt-der-zustaendigkeit.md) Punkt 4 · **Fundstelle:** `services/requirement/src/berechtigung/`, `infra/local/compose.yaml`

> **Erledigt am 2026-08-14.** `findAll` und `findAsOf` fragen die Richtlinie; der
> handgeschriebene Mandantenfilter ist entfallen. Die Engine entscheidet damit jeden
> Lesevorgang über die Liste.
>
> **Nicht erledigt ist der direkte Zugriff über Kennung und Herkunft** – der läuft weiter
> gegen die Mandantenzugehörigkeit allein. Das ist `PROD-060` und ausdrücklich ein eigener
> Eintrag, damit dieser hier nicht als „Berechtigung ist umgestellt" gelesen wird.

Der ursprüngliche Befund, zur Nachvollziehbarkeit:

Nach M5.2 steht der Rahmen: OPA läuft als Sidecar, die Richtlinie ist geschrieben und
getestet, der Client übersetzt ihre Auskunft in eine Abfragebedingung, und ein
Integrationstest belegt, dass diese dieselbe Menge liefert wie der Filter aus M5.1.

**Im Anwendungspfad ruft niemand den Client auf.** Gefiltert wird weiterhin in SQL. Die
Berechtigung entscheiden die Guards aus M3.2 und die Zugehörigkeitsprüfung aus M5.1 – die
Engine entscheidet nichts.

Das ist der geplante Zwischenzustand und kein Fehler. Der Eintrag steht hier wegen seiner
**Erscheinungsform**, demselben Muster wie `PROD-052`, `PROD-017` und `PROD-056`: Ein
Container in jeder Umgebung, eine Pflichtvariable `OPA_URL` ohne die der Dienst nicht
startet, ein angenommenes ADR und grüne Tests. Alles daran sieht nach vorhandener
richtlinienbasierter Autorisierung aus. Wer den Compose-Eintrag liest, hat keinen Anlass zu
vermuten, dass die Engine im Leerlauf läuft.

Hinzu kommt eine kleinere, konkrete Folge: `OPA_URL` wird im Konstruktor mit `getOrThrow`
gelesen. **Jede Umgebung muss einen Sidecar konfigurieren, der nichts tut** – fehlt der
Wert, startet der Dienst nicht.

**Zielzustand:** Mit M5.3 übernimmt die Engine den Lesezuschnitt, und der SQL-Filter aus
M5.1 entfällt. Bis dahin ist dieser Eintrag die einzige Stelle, an der steht, dass die
Engine nicht wirkt.

**Woran es auffiele, wenn es länger dauert:** an nichts. Ein unbenutzter Client verursacht
keine Fehler. Genau deshalb steht er in dieser Liste und nicht nur im ADR.

#### PROD-060 — Der Zuschnitt gilt für die Liste, nicht für den direkten Zugriff
**Schwere:** Hoch · **Status:** **Erledigt mit M5.4 (2026-08-17)** · **Betrifft:** §8 · **Verweis:** [ADR-0029](../adr/0029-zuschnitt-der-zustaendigkeit.md) Punkt 4, [ADR-0030](../adr/0030-feldebene-und-vertretung.md) Punkt 2 · **Fundstelle:** `requirements.service.ts`, `ausHerkunft` und `ausKennung`

> **Erledigt am 2026-08-17.** Beide Auflösungspunkte tragen die Bedingung jetzt **in der
> Abfrage**: Ein nicht sichtbarer Datensatz wird nicht gefunden, und die 404 folgt daraus,
> statt danebengeprüft zu werden. Die Mandantenprüfung ist entfallen – sie steckt seither in
> `im_mandanten` und damit in jedem Zweig der Richtlinie.
>
> Vorher umgesetzt wurde die Vertretung durch eine Gruppe, wie es die Frist hier verlangte:
> Ohne sie hinge eine Anforderung an genau einer Person.
>
> **Was der Umbau sichtbar gemacht hat:** 48 Integrationstests wurden rot, weil überall ein
> Vorsystem anlegte und ein Mensch zugriff. Das war kein Fixture-Problem, sondern die
> Zusicherung selbst – und die Gruppe ist die Antwort darauf, auch in der Wirklichkeit.
>
> Was dabei **nicht** gelöst wurde, steht in `PROD-063`: Beide Felder sind Freitext.

Der ursprüngliche Befund, zur Nachvollziehbarkeit:

Seit M5.3 schneidet die Richtlinie den Lesepfad zu: Ein Anwender sieht in der Liste seine
eigenen Anforderungen, ein Betreiber alle seines Mandanten.

**Die Auflösung eines einzelnen Datensatzes prüft weiterhin nur die Mandantenzugehörigkeit.**
`ausHerkunft` und `ausKennung` sind die beiden Stellen, an denen ein Datensatz nachgeschlagen
wird; beide vergleichen `benutzer.tenants` gegen `bestand.tenant` und sonst nichts. Wer die
Kennung oder die Herkunft eines fremden Datensatzes im selben Mandanten kennt, erreicht
darüber weiterhin:

- die Versionshistorie (`GET /{id}/versions`)
- die zulässigen Übergänge und den Zustandswechsel
- das Ändern über Kennung und über die Herkunft
- Festhaltungen

**Es ist keine Verschlechterung** – vor M5.3 durfte jedes Mitglied eines Mandanten ohnehin
alles. Es ist eine **unvollständige Verengung**, und das ist die gefährlichere Sorte: Die
Liste verbirgt, was der direkte Zugriff herausgibt. Wer das ADR liest oder die Oberfläche
benutzt, schließt auf einen Zuschnitt, den es nur zur Hälfte gibt.

**Zielzustand:** Dieselbe Bedingung auch dort. Weil sie bereits als SQL vorliegt, ist der
Weg derselbe wie bei der Liste – die Abfrage nach Kennung bekommt sie zusätzlich, und ein
nicht sichtbarer Datensatz liefert wie bisher **404 und nicht 403**. Damit bleibt es bei
einem Mechanismus statt einer zweiten Prüfung neben der ersten.

**Zu bedenken vor der Umsetzung:** Diese beiden Stellen tragen auch den Schreibpfad. Mit
der Verengung kann eine Anforderung nur noch von ihrem Eigentümer und von Betreibern
geändert werden – ein Abwesender nähme seine Vorgänge mit.

**Auslöser für die Umsetzung – sachlich, nicht terminlich:** Sobald der Datensatz ein
zweites zuständigkeitstragendes Merkmal trägt, das **mehr als eine Person erfüllen kann**.
Konkret die Vertretung durch eine Gruppe, geführt als vertagte Entscheidung im ADR-Index
und auf **M5.4** datiert. Sie ist schmal: eine Kernspalte an `requirement` und ein Anspruch
im Token, dieselbe Mechanik wie der Mandant seit M5.1, und der Übersetzer beherrscht die
nötige Form (`in` auf einer Kernspalte) bereits.

Vorher zu schließen hieße, eine Anforderung an genau einen Menschen zu binden. **Beides
gehört vor den Abschluss von M5**, und in dieser Reihenfolge.

Eine Aufteilung nach Lesen und Schreiben ist ausdrücklich **kein** Zwischenweg:
`ausKennung` bedient beide, und ein Schalter, der sagt „hier weniger prüfen", ist genau die
Sorte Sonderfall, die der eine Auflösungspunkt vermeiden sollte.

#### PROD-062 — Die zuständige Gruppe ist nur über die Schnittstelle setzbar
**Schwere:** Mittel · **Status:** **Erledigt mit M5.4 (2026-08-19)** · **Betrifft:** §8, §15 · **Verweis:** [ADR-0030](../adr/0030-feldebene-und-vertretung.md) Punkt 1 · **Fundstelle:** `frontend/src/app/anforderungen/`

> **Erledigt am 2026-08-19**, beide Fälle: Die Gruppe hat ein Feld im Anlageformular und
> eine Spalte in der Liste, die Feldsichtbarkeit ein Feld und eine Spalte in der
> Verwaltungsoberfläche.
>
> **Dabei ist ein Widerspruch aufgefallen und mitbehoben worden:** Das Anlageformular bot
> Eingabefelder für Attribute an, die der Anwender anschließend nicht sehen darf. Er hätte
> einen Wert eingetragen, gespeichert – und ihn nie wieder gesehen; beim nächsten Bearbeiten
> stünde das Feld leer, obwohl es gefüllt ist. `istSichtbar` filtert die angebotenen Felder
> jetzt mit. Die Regel steht damit an zwei Orten, und der Kommentar an der Filterstelle sagt,
> welcher maßgeblich ist: die Engine.

Die Vertretung steht: Spalte, Anspruch, Richtlinienzweig und Tests. **Die Oberfläche kennt
sie nicht** – `responsibleGroup` kommt im Frontend nicht vor, weder im Anlageformular noch
in der Liste.

Damit ist die Gruppe für Anwender unerreichbar, und der Zweck der Vertretung – jemand geht
in Urlaub, ein Kollege übernimmt – ist über die Oberfläche nicht erfüllbar. Dieselbe Lage
wie bei `PROD-056`, wo der Mandant an Definitionen nur per SQL zu setzen ist.

**Besonders unangenehm wird es mit `PROD-060`:** Sobald der direkte Zugriff verengt ist,
entscheidet die Gruppe darüber, wer eine Anforderung überhaupt noch ändern kann. Ein Feld,
das über die Oberfläche nicht zu setzen ist, wird dann zur Voraussetzung für Arbeit, die
über die Oberfläche stattfindet.

**Zielzustand:** Ein Feld im Anlageformular, vorbelegt mit nichts, und die Gruppe in der
Liste sichtbar. Die Auswahl kann bis M6 eine freie Eingabe sein – es gibt keine Liste
gültiger Gruppen, gegen die geprüft werden könnte, genau wie beim Mandanten.

**Vor `PROD-060`**, nicht danach.

> **Zweiter Fall mit der Feldebene, 2026-08-19.** `visibleFor` an der Attributdefinition
> ist über die Schnittstelle setzbar, in der Verwaltungsoberfläche nicht. Ein Administrator
> kann ein Attribut anlegen, aber nicht bestimmen, wer es sehen darf – und genau das ist
> nach §6 der Zweck der Angabe.
>
> **Als Nachtrag und nicht als eigener Eintrag**, weil Ursache und Behebung dieselben sind:
> ein Feld in einem Formular, das es schon gibt. `PROD-061` warnt ausdrücklich davor, gleiche
> Ursachen zu vervielfachen.
>
> Damit sind es drei Angaben, die die Oberfläche nicht setzen kann: der Mandant an
> Definitionen (`PROD-056`), die zuständige Gruppe und die Feldsichtbarkeit. **Alle drei vor
> dem Abschluss von M5**, sonst ist die Konfigurierbarkeit aus §6 eine Zusicherung an
> Aufrufer der Schnittstelle und nicht an Administratoren.

#### PROD-063 — Zugriff hängt an zwei frei beschreibbaren Textfeldern
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §8 · **Verweis:** [ADR-0029](../adr/0029-zuschnitt-der-zustaendigkeit.md), [ADR-0030](../adr/0030-feldebene-und-vertretung.md) · **Fundstelle:** `requirement.owner`, `requirement.responsible_group`

Seit M5.3 entscheidet `owner` und seit M5.4 zusätzlich `responsible_group` darüber, wer
eine Anforderung sieht und ändern darf. **Beide sind Textspalten, die der Aufrufer setzt.**
Geprüft wird nichts – es gibt weder eine Liste gültiger Anwender noch eine gültiger Gruppen,
genau wie beim Mandanten ([ADR-0026](../adr/0026-wirksamer-mandant-und-stufung-der-konfiguration.md)
Punkt 6).

**Vorgeführt am 2026-08-17** beim Umbau von `mandant.integration.spec.ts`: Ein PATCH, der
`owner` auf einen anderen Namen setzt, nimmt dem Aufrufer den Zugriff auf den eigenen
Datensatz. Die folgende Abfrage antwortet mit 404. Kein Fehler, keine Warnung – die
Anforderung ist aus seiner Sicht verschwunden.

Zwei Richtungen, beide ohne Rückmeldung:

- **Selbstaussperrung.** Ein Tippfehler im Namen genügt, und der Datensatz ist für den
  Verfasser unauffindbar. Bei `responsible_group` dasselbe, nur schwerer zu bemerken – dort
  fehlt keine eigene Anforderung, sondern die Vertretung greift stillschweigend nicht
- **Zuschieben.** Wer einen fremden Namen einträgt, legt einen Datensatz in die Liste einer
  anderen Person. Innerhalb des Mandanten und ohne deren Zutun

**Zielzustand:** Identitäts- und Gruppenbezüge statt Zeichenketten, geprüft gegen den
Identity & Access Service. Das ist **M6** – vorher gibt es nichts, wogegen geprüft werden
könnte.

**Was vorher hilft und billig ist:** Die Oberfläche belegt `owner` bereits mit dem
angemeldeten Anwender vor. Für die Gruppe wäre eine Auswahl aus den eigenen
Gruppenzugehörigkeiten – die im Token stehen – dasselbe Mittel: Sie verhindert den
Tippfehler, ohne eine Prüfung zu behaupten, die es nicht gibt.

#### PROD-064 — Eigenerfasste Anforderungen sind über keine Schnittstelle änderbar
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §16, §19.2 · **Fundstelle:** `requirements.controller.ts`, einzige PATCH-Route

Es gibt genau einen Änderungsweg: `PATCH /v1/requirements/by-source/:sourceSystem/:externalId`.
**Ein `PATCH /v1/requirements/:id` existiert nicht.** Eine über die Oberfläche erfasste
Anforderung hat keinen externen Bezeichner und ist damit über den allgemeinen Schreibpfad
unerreichbar. Änderbar ist an ihr ausschließlich der Zustand (`PUT :id/state`) und die
Workflow-Fassung.

**Bis M5.4 folgenlos**, weil die Oberfläche kein Änderungsformular hat und niemand es
vermisste. Mit der Vertretung ändert sich das: Die zuständige Gruppe ist das Feld, das man
am ehesten nachträglich setzt – wenn jemand ausfällt –, und sie ist an genau den
Datensätzen unerreichbar, die über die Oberfläche entstehen.

§19.2 verlangt drei gleichrangige Eingangswege mit demselben Verarbeitungspfad. Für das
**Ändern** ist die manuelle Erfassung derzeit nicht gleichrangig, sondern gar nicht
vorhanden.

**Zielzustand:** Eine PATCH-Route über die Kennung, die denselben Dienstaufruf benutzt wie
die vorhandene. Der Auflösungspunkt `ausKennung` steht bereits und trägt seit M5.4 auch den
Zuschnitt – es fehlt die Controller-Methode und ihre Vertragsbeschreibung.

**Woran es auffiel:** an einem Test, der die Gruppe nachträglich setzen wollte und 404
bekam. Nicht an der Oberfläche, die den Fall gar nicht erst anbietet.

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

> **Ergänzt am 2026-08-11 mit M4.3.** Ein Workflow-Übergang kann jetzt eine Rolle verlangen
> ([ADR-0024](../adr/0024-bedingungen-an-workflow-uebergaengen.md)). Damit gibt es zum
> ersten Mal eine Berechtigungsprüfung, die **nicht** am Endpunkt hängt, sondern am
> einzelnen Vorgang – ein Schritt in Richtung §8, aber nur einer.
>
> **Die Rolle gilt global.** „Freigeber" heißt „Freigeber überall", nicht „Freigeber für
> dieses Projekt, diese Kostenstelle, diesen Mandanten". Objektbezug, Feldebene und
> Mandantenzuschnitt fehlen unverändert.
>
> Die Erscheinungsform ist heikler als vorher: Eine Freigaberolle an einem Übergang **sieht
> aus** wie eine zugeschnittene Zuständigkeit. Wer einen Genehmigungsablauf konfiguriert,
> hat keinen Anlass zu vermuten, dass die Rolle für sämtliche Projekte gilt. Dasselbe
> Muster wie bei `PROD-052`, eine Ebene tiefer.
>
> Das Datum bleibt bei M5 nutzbar: Welche Zuständigkeit ein Übergang verlangt, ist in jeder
> Variante Fachdatum. Was sich ändert, ist der Prüfer.

> **Auf M6 datiert am 2026-08-14 mit [ADR-0029](../adr/0029-zuschnitt-der-zustaendigkeit.md).**
> M5.3 sollte diesen Eintrag auflösen. Das ist nicht möglich: Eine zugeschnittene
> Freigaberolle verlangt eine Zuständigkeit **je Bereich und Person**, und dafür gibt es vor
> dem Identity & Access Service keine Quelle. Die geprüften Wege scheiden aus – Ansprüche im
> Token an der gemessenen Grenze aus `PROD-045`, eine eigene Zuordnungstabelle an §5.
>
> M5.3 schneidet stattdessen nach Mandant und Eigentümer zu. **Das ist Objektbezug, aber der
> schwächste denkbare**, und es löst diesen Eintrag ausdrücklich nicht auf. Wer nach M5.3
> „Berechtigung am Objekt" liest und ihn für erledigt hält, liegt falsch – die Freigaberolle
> gilt weiterhin überall.

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

> **Ergänzt am 2026-08-13 mit M5.1.** Die Sitzung führt jetzt zusätzlich die
> Mandantenzugehörigkeiten (`mandanten`), weil das Anlageformular eine Auswahl braucht und
> der Anspruch nur im Token steht. Die Steigung oben gilt sinngemäß: **rund 48 Byte je
> Mandant**, dazu derselbe Wert ein zweites Mal, weil `tenants` auch im Zugriffstoken
> selbst steht.
>
> Bei einem Mandanten ist das folgenlos. Die Rechnung ändert sich mit §15: Ein Anwender in
> zehn Mandanten kostet rund 1000 Byte – **den gesamten verbleibenden Spielraum**, ohne
> eine einzige zusätzliche Rolle. Damit ist die Mandantenfähigkeit neben dem
> Rollenmodell der zweite Wachstumspfad, und beide wachsen multiplikativ, nicht additiv:
> Rollen je Mandant ist die realistische Ausbaustufe.
>
> **Die Messung oben ist damit veraltet und vor M6 zu wiederholen.** Sie stammt aus M2.3
> und kennt weder die Mandanten noch den zweiten Service.
>
> Wichtiger als die Tabelle ist die automatische Prüfung in
> `frontend/test/sitzungsgroesse.integration.spec.ts`. Sie baut den Sitzungsinhalt
> **nach** – „derselbe Inhalt, den der Rückruf schreibt" – und misst ihn. Diese
> Entsprechung hält keine Übersetzung und kein Test aufrecht: Wer dem Rückruf ein Feld
> hinzufügt und dem Prüfaufbau nicht, misst weiter die alte Sitzung und bekommt grün.
> **Jedes neue Feld in `Sitzungsinhalt` gehört in denselben Arbeitsschritt in diesen
> Prüfaufbau.**

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

#### PROD-056 — Mandantenspezifische Konfiguration ist lesbar, aber über keine Schnittstelle anlegbar
**Schwere:** Mittel · **Status:** **Erledigt mit M5.4 (2026-08-19)** · **Betrifft:** §8, §15 · **Verweis:** [ADR-0026](../adr/0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 4 · **Fundstelle:** `attribute-definitions.service.ts` `create`/`update`, `mastership.service.ts`, `workflows.service.ts`

> **Erledigt am 2026-08-19.** Alle drei Konfigurationsobjekte nehmen einen Mandanten über
> die Schnittstelle an und tragen ein Feld in der Verwaltungsoberfläche: Attributdefinition,
> Hoheitsregel, Workflow-Definition. Geprüft wird gegen die Zugehörigkeiten im Token – ein
> fremder Mandant wird mit 403 abgewiesen.
>
> **Der Mandant fehlt bewusst in allen Änderungs-DTOs.** Er gehört zur Identität der
> Definition – er steht in deren Eindeutigkeit –, und ihn zu ändern wäre kein Ändern,
> sondern ein Verschieben zwischen Mandanten.
>
> **Nicht erledigt und ausdrücklich getrennt:** die Anzeige, welche Definition für eine
> gegebene Kombination *tatsächlich* gilt. Sie steht als Folgeentscheidung in ADR-0026 und
> ist mit der Rangfolge aus Punkt 5 die eigentlich schwierige Hälfte.
>
> Was mit dem Mandanten **nicht** eingeführt wurde: die Unterscheidung zwischen einem
> Administrator eines Mandanten und einem Betreiber der Plattform. Ein leerer Mandant heißt
> „für alle", und setzen darf ihn jeder `platform-admin`. Das ist keine Verschlechterung –
> heute ist jede Definition plattformweit –, aber es bleibt für M6.

ADR-0026 Punkt 4 stuft die Konfiguration: plattformweite Vorgabe plus mandantenspezifische
Ergänzung, für Attributdefinitionen, Hoheitsregeln und Workflow-Definitionen. Die Spalte
steht in allen drei Tabellen, die Auflösung ist umgesetzt und mit Tests belegt.

**Der Schreibpfad kennt sie nicht.** In allen drei Diensten kommt `tenant` ausschließlich in
`findKandidaten` vor. Weder die Anlege-DTOs noch `create`/`update` reichen einen Mandanten
durch, und die Verwaltungsoberfläche hat kein Feld dafür. Jede über die Schnittstelle oder
die Oberfläche angelegte Definition ist damit plattformweit – **die zweite Stufe ist nur
per direktem SQL erreichbar.** In den Integrationstests tut genau das der Testhelfer.

Die Wirkung ist nicht „ein Feld fehlt", sondern: Von der Mandantenfähigkeit aus §15 ist der
Teil umgesetzt, der Daten trennt, und der Teil nicht umgesetzt, der Fachlichkeit trennt –
also der, dessentwegen die Entscheidung überhaupt getroffen wurde. Die verworfene
Alternative „Konfiguration ausschließlich plattformweit" beschreibt den heutigen Zustand
genauer als die getroffene Entscheidung.

**Gefährlich ist die Erscheinungsform**, dasselbe Muster wie bei `PROD-052` und der
Freigaberolle in `PROD-017`: Die Auflösung funktioniert, die Tests sind grün, das ADR ist
angenommen. Wer die Stufung für nutzbar hält, findet drei Belege dafür und keinen dagegen.

**Zielzustand:** `tenant` in den Anlege- und Änderungs-DTOs der drei Konfigurationsobjekte,
mit Prüfung gegen die Zugehörigkeiten im Token – ein platform-admin darf für einen fremden
Mandanten nichts festlegen –, und ein Feld in der Verwaltungsoberfläche. **Vor Abschluss von
M5**, sonst schließt der Meilenstein mit einer Zusicherung, die nur auf dem Lesepfad gilt.
Die Anzeige der tatsächlich geltenden Definition ist davon getrennt und in ADR-0026 zu M5.4
geführt.

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

#### PROD-057 — Migration 0011 ist auf eine Tabelle mit Inhalt nicht anwendbar
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §14, §19.4 · **Verweis:** [ADR-0026](../adr/0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 3 · **Fundstelle:** `services/requirement/drizzle/0011_stale_weapon_omega.sql`, Zeilen 9–10

```sql
ALTER TABLE "requirement" ADD COLUMN "tenant" text NOT NULL;
```

Ohne `DEFAULT` und ohne Rückfüllung. PostgreSQL weist das auf einer Tabelle mit Zeilen ab
(*column "tenant" contains null values*). Die Migration setzt eine leere Tabelle voraus.

**Bemerkt wurde es nicht**, weil beide Umgebungen, in denen sie bisher lief, diese
Voraussetzung erfüllen: die Entwicklungsdatenbank war leer, und die CI setzt je Lauf eine
frische auf. Eine Migration, die nur gegen leere Datenbanken erprobt wird, sagt nichts
darüber aus, ob sie einen Bestand überlebt – und das gilt für **jede** Migration in diesem
Verzeichnis, nicht nur für diese.

**Ein ehrlicher Rückfüllwert existiert nicht.** ADR-0026 Punkt 3 verwirft einen
Vorgabewert ausdrücklich: „Ein Wert wie ‚standard' wäre ein erfundener Mandant, und die
erste Frage nach Mandantenfähigkeit hätte eine falsche Antwort." Diese Begründung gilt für
die Rückfüllung unverändert. Die Migration ist damit fachlich richtig und auf gefüllten
Daten unbrauchbar – ein Widerspruch, der sich nicht im Schema auflösen lässt, sondern nur
durch eine Entscheidung darüber, welchem Mandanten Altbestand zugerechnet wird.

**Zielzustand:** Zwei Punkte, und der zweite wiegt schwerer.

1. Für diese Migration eine Zuordnungsregel für Altbestand, bevor die erste Umgebung
   Daten führt, die ein Deployment überleben müssen. Ohne Altbestand ist nichts zu tun –
   die Frage stellt sich erst mit ihm.
2. **Migrationen gegen einen gefüllten Stand prüfen, nicht nur gegen eine leere
   Datenbank.** Ein Testlauf, der einen Bestand anlegt, dann die Migration fährt, deckt
   diese Klasse von Fehlern auf. Ohne ihn fällt sie erst bei der Bereitstellung auf, und
   dann in der Umgebung, in der sie am teuersten ist.

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

#### PROD-061 — Die Ignorierliste wächst schneller, als sie gelesen wird
**Schwere:** Mittel · **Status:** Offen · **Betrifft:** §13 · **Verweis:** `PROD-037` · **Fundstelle:** `.trivyignore.yaml`

Die Liste ist innerhalb von drei Tagen von 15 auf 39 Einträge gewachsen:

| Datum | Anlass | Neue Einträge |
|---|---|---|
| 2026-08-13 | OPA kommt als Laufzeit-Image dazu (M5.2) | 3 |
| 2026-08-14 | zwei Go-Lücken veröffentlicht | 3 |
| 2026-08-16 | sechs Go-Lücken veröffentlicht | 12 |

**Der überwiegende Teil beschreibt kein Risiko unserer Software.** Er beschreibt das Alter
der Go-Fassung, mit der fremde Abbilder gebaut sind – `gosu` mit go1.24.6, OPA mit
go1.26.5. Jede neue Lücke in der Standardbibliothek erzeugt Einträge in **jedem** Abbild,
das ein Go-Programm enthält, und zwar je Kennung und je Pfad einzeln.

**Das Verfahren ist richtig, die Frequenz sprengt es.** Die Regeln aus `PROD-037` –
Begründung je Eintrag, Frist, engstmögliche Eingrenzung – sind genau die, die eine
Unterdrückung überprüfbar halten. Sie setzen aber voraus, dass Einträge einzeln entstehen
und einzeln gelesen werden. Bei zwölf auf einmal, alle mit derselben Ursache, geschieht
zweierlei: Die Begründungen werden mechanisch, und die Liste wird zu lang, um im Review
tatsächlich gelesen zu werden.

**Woran es auffiele, dass die Erosion eingetreten ist:** an nichts. Ein Tor, dessen
Ausnahmeliste niemand mehr liest, ist grün wie eines ohne Ausnahmen. Genau deshalb steht
dieser Eintrag hier und nicht als Anmerkung in der Datei.

**Zielzustand – zwei Teile, und der erste ist der wichtigere:**

1. **Befunde der Go-Standardbibliothek werden nach ihrer Ursache behandelt, nicht einzeln.**
   Sinnvoll wäre eine Gruppierung je Abbild und Go-Fassung mit **einer** Begründung und
   **einer** Frist, statt je Kennung. Ob `.trivyignore.yaml` das ausdrücken kann, ist zu
   prüfen; falls nicht, ist ein erzeugter Abschnitt mit gemeinsamer Kopfzeile die
   nächstbeste Form. Die Unterscheidung aus `PROD-037` – erreichbar oder nicht – bleibt
   dabei unangetastet, sie wird nur einmal je Gruppe getroffen statt einmal je Kennung.
2. **Ein Blick auf die Gesamtzahl gehört ins Review.** Wächst die Liste zwischen zwei
   Ständen um mehr als eine Handvoll, ist die Ursache zu benennen, bevor die Einträge
   übernommen werden.

**Nicht gemeint ist eine Lockerung.** Die Frist bleibt Pflicht, die Eingrenzung über
`paths` bleibt Pflicht, und „wir sind nur nicht aktuell" bleibt kein Grund. Es geht allein
darum, dass eine Liste, die niemand mehr liest, ihre Aufgabe nicht mehr erfüllt.

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
**Schwere:** Hoch · **Status:** ~~Offen~~ **Erledigt (2026-08-11)** · **Betrifft:** §7 · **Fundstelle:** `services/requirement/src/workflows/`, `services/requirement/src/requirements/`

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

> **Geschlossen am 2026-08-11 mit M4.3** – [ADR-0024](../adr/0024-bedingungen-an-workflow-uebergaengen.md).
>
> Übergänge tragen jetzt Bedingungen: benötigte Rolle, Vier-Augen-Prinzip, Pflichtfelder,
> Feldwerte, Begründungspflicht – jeweils mit einem optionalen Vorbehalt. Damit erzwingt der
> Ablauf, was §7 nennt, und der Eintrag hat seinen Gegenstand verloren.
>
> **Eine Bedingung, die sich nicht auswerten lässt, weist ab.** Das war die Festlegung mit
> der größten Tragweite: Eine Genehmigungsstrecke, die bei fehlenden Daten nachgibt, gäbe
> genau dann nach, wenn etwas nicht stimmt.
>
> **Zwei Punkte sind nicht miterledigt und stehen anderswo:**
>
> - Die Rolle am Übergang gilt **global** – „Freigeber überall", nicht „Freigeber für dieses
>   Projekt, diese Kostenstelle". Der Objektbezug aus §8 kommt mit M5; geführt unter
>   `PROD-017`.
> - Workflows sind nur über die Schnittstelle konfigurierbar, nicht über eine
>   Verwaltungsoberfläche; geführt unter `PROD-054`.

#### PROD-055 — Der offene Lesezugriff auf Workflows gibt die Genehmigungsstruktur preis
**Schwere:** Mittel · **Status:** ~~Bewusst akzeptiert~~ **Erledigt (2026-08-11)** · **Betrifft:** §8, §15 · **Fundstelle:** `services/requirement/src/workflows/workflows.controller.ts`, `GET /v1/workflow-definitions`

> **Der Eintrag war beim Verfassen sachlich falsch.** Er behauptete, der offene Lesezugriff
> gebe seit M4.3 die Bedingungen preis. Das traf nicht zu: `toResponse` im Workflow-Service
> schreibt die Übergänge Feld für Feld aus und ließ `bedingungen` weg – aus M4.1, wo es
> noch nichts wegzulassen gab. Die Antwort enthielt sie nie. Ich habe das angenommen,
> statt nachzusehen; aufgefallen ist es erst, als der Editor sie durchreichen sollte und
> im Contract nicht fand.
>
> Der zweite Teil war ebenfalls überholt: Die Begründung für den offenen Zugriff – die
> Oberfläche brauche den Graphen – gilt seit M4.5 nicht mehr. Was ein Erfasser sehen muss,
> liefert `GET /v1/requirements/{id}/transitions` für seine eigene Anforderung. Die
> vollständige Liste liest nur der Verwaltungseditor aus M4.6.
>
> **Erledigt am 2026-08-11 mit M4.6**, und zwar anders als hier vorgeschlagen: `bedingungen`
> ist in die Antwort aufgenommen **und** `GET /v1/workflow-definitions` samt
> `GET /{id}/versions` auf `platform-admin` beschränkt. Die verworfene Alternative – eine
> zweite Antwortgestalt für Nicht-Administratoren – wurde damit gegenstandslos: Es gibt für
> sie keinen Lesezugriff mehr, den man zuschneiden müsste.
>
> Die unten beschriebene Spannung zu `PROD-034` besteht weiter, aber in engerer Form: Die
> Übergangsauskunft nennt Rollennamen am einzelnen Übergang einer einzelnen Anforderung.
> Das ist notwendig – sonst zeigt die Oberfläche gesperrte Schaltflächen ohne Erklärung –
> und deutlich weniger als der ganze Graph.
>
> **Für M5 bleibt die Frage aus dem letzten Absatz:** Mit Mandantenfähigkeit ist erneut zu
> prüfen, ob ein Administrator die Genehmigungsstruktur fremder Mandanten sehen darf. Das
> gehört dann zu `PROD-017`, nicht hierher.

*Der ursprüngliche Text steht unverändert darunter.*

`GET /v1/workflow-definitions` ist für **jeden angemeldeten Anwender** lesbar. Das war eine
bewusste Entscheidung aus M4.1: Die Oberfläche baut daraus Zustandsnamen und Schaltflächen,
und ein Leseschutz hätte sie für gewöhnliche Anwender unbrauchbar gemacht.

**Mit M4.3 hat sich geändert, was dieser Zugriff preisgibt.** Vorher waren es Zustände und
Übergänge. Seither trägt der Graph die Bedingungen: welche Rolle freigeben darf, ab welchem
Betrag eine zusätzliche Genehmigung nötig ist, wo das Vier-Augen-Prinzip greift. Der
Endpunkt stand schon offen, die Information ist dazugekommen – **niemand hat das
entschieden.**

**Bewusst akzeptiert, mit Begründung.** Genehmigungswege sind in den meisten Häusern keine
Geheimnisse, und die Oberfläche braucht den Graphen einschließlich der Bedingungen: Ohne
sie kann sie nicht sagen, warum ein Übergang nicht angeboten wird. Die Alternative – eine
zweite Antwortgestalt ohne `bedingungen` für Nicht-Administratoren – kostet einen zweiten
Vertrag für dieselbe Ressource bei geringem Gewinn.

Damit ist auch die scheinbare Spannung zu `PROD-034` aufgelöst: Der `RollenGuard` nennt
bewusst nicht, welche Rolle fehlt; die Übergangsauskunft an der Anforderung nennt sie sehr
wohl. Das ist kein Widerspruch, sondern eine Folge davon, dass die Rollennamen über die
Workflow-Definition ohnehin lesbar sind.

**Woran die Entscheidung zu überprüfen ist:** Sobald Mandantenfähigkeit greift (§15, M5),
stellt sich die Frage neu – ein Anwender sähe dann die Genehmigungsstruktur **fremder
Mandanten**. Der Eintrag ist mit M5 erneut zu bewerten und nicht vorher zu schließen.

#### PROD-054 — Workflows sind nur über die Schnittstelle konfigurierbar
**Schwere:** Mittel · **Status:** ~~Offen~~ **Erledigt (2026-08-12)** · **Betrifft:** §7 · **Verweis:** Meilensteine M4.6, M4.7

§7 verlangt, dass Workflows „über Admin-UI/Config statt Redeploy" konfiguriert werden. Die
Definitionen **sind** Fachdaten und ohne Redeploy änderbar – aber es gibt keine
Verwaltungsoberfläche für sie. Wer einen Zustand hinzufügt oder eine Bedingung ändert,
stellt den Graphen als JSON zusammen und schickt ihn gegen die API.

Die Oberfläche aus M3.6 deckt Attributdefinitionen, Hoheitsregeln und Festhaltungen ab;
für Workflows gibt es nichts Vergleichbares. M4.5 ist die Sicht des **Erfassers** – Übergänge
als Schaltflächen –, nicht die des Administrators.

**Warum das mehr ist als Bequemlichkeit.** Ein Ablauf, den nur ändern kann, wer JSON und
das Vokabular aus ADR-0024 beherrscht, wird faktisch von der Entwicklung gepflegt. Damit
ist die Zusicherung aus §7 – Fachlichkeit ohne Auslieferung änderbar – im Betrieb nicht
eingelöst, obwohl sie technisch besteht. Der Unterschied fällt erst auf, wenn eine Änderung
dringend ist.

**Zielzustand:** M4.6. Das Vokabular ist darauf zugeschnitten: feste Listen von
Bedingungsarten und Vergleichen, jeder Vergleich aus Feld, Operator und Wert – als Formular
mit Auswahllisten darstellbar, ohne freien Ausdruck.

> **Teilweise geschlossen am 2026-08-11 mit M4.6.**
>
> Es gibt einen Verwaltungsbereich für Workflows: Zustände, Übergänge, Betriebsart,
> Anfangszustand und Außerkraftsetzung sind über die Oberfläche pflegbar, dazu die
> Auskunft, wie viele Anforderungen auf welcher Fassung laufen. Ebenfalls dazugekommen sind
> die beiden Verwaltungsvorgänge an der Anforderung – Zustand zuordnen und auf die aktuelle
> Fassung heben –, für die es zuvor **überhaupt keine Oberfläche gab**: Eine
> hängengebliebene Anforderung ließ sich nur mit `curl` befreien, obwohl die Oberfläche seit
> M4.5 genau darauf hinwies.
>
> **Offen bleiben die Bedingungen.** Rolle, Vier-Augen-Prinzip, Pflichtfelder und Vorbehalte
> sind weiterhin nur über die Schnittstelle pflegbar. Der Editor **reicht sie unverändert
> durch** und zeigt je Übergang ihre Anzahl an – ohne das würde jedes Speichern über die
> Oberfläche sie löschen, weil `PUT` die Definition vollständig ersetzt.
>
> Damit ist der schwerwiegendere Teil offen: Genau die Bedingungen tragen die
> Genehmigungsstrecke. Sie kommen als eigener Schritt.

> **Geschlossen am 2026-08-12 mit M4.7.**
>
> Bedingungen sind über einen Dialog je Übergang pflegbar: sechs Anforderungsarten, sechs
> Vergleiche, Vorbehalte als eigene Liste. Damit ist §7 auch im Betrieb erfüllt – ein Ablauf
> lässt sich ohne Auslieferung ändern, und zwar von jemandem, der weder JSON noch das
> Vokabular aus ADR-0024 beherrschen muss.
>
> **Was der Editor bewusst nicht tut:** Er prüft den Graphen nicht vor. Sackgassen,
> unerreichbare Zustände, unbekannte Felder und der Vier-Augen-Bezug werden beim Speichern
> geprüft, und die Meldung nennt die Fundstelle. Eine zweite Prüfung im Browser wäre eine
> zweite Fassung derselben Regeln – und läge bei der ersten Abweichung falsch.
>
> Die Vorschlagsliste der Feldnamen führt die Kernfelder als Kopie; der Contract weist sie
> nicht als Aufzählung aus. Fehlt dort künftig eines, fehlt es als **Vorschlag**, nicht als
> Möglichkeit – eingeben lässt sich jedes Feld, und geprüft wird beim Speichern.

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

> **Vierter Fall am 2026-08-11 mit M4.6 – diesmal Berechtigung statt Validierung.**
> `GET /v1/workflow-definitions` und `GET /{id}/versions` sind von „jeder Angemeldete" auf
> `platform-admin` verengt worden. Für jeden Aufrufer, der sie bisher las, ist das eine
> brechende Änderung.
>
> **Im Contract steht davon nichts.** Rollen sind kein Bestandteil des OpenAPI-Schemas –
> `security` nennt das Verfahren (Bearer-Token), nicht die verlangte Rolle. `oasdiff` sah
> eine geänderte Beschreibung und blieb grün.
>
> Damit hat die Prüfliste eine dritte Art von Änderung: **verschärfte Berechtigungen.** Sie
> sind besonders unauffällig, weil sie weder im Schema noch im Code des Aufrufers sichtbar
> werden – der bekommt eines Tages 403 und weiß nicht, warum.

> **Fünfter Fall am 2026-08-13 mit M5.1 – und erstmals eine Lockerung.**
> [ADR-0026](../adr/0026-wirksamer-mandant-und-stufung-der-konfiguration.md) Punkt 5 legt
> fest, dass je Schlüssel genau eine Attributdefinition gilt – die spezifischste. Bisher
> liefen **alle** gelieferten Definitionen durch die Prüfung. Wer denselben Schlüssel
> einmal allgemein und einmal je Anforderungstyp gepflegt hatte, bekam beide Prüfungen;
> künftig nur noch eine.
>
> Am Contract ändert sich nichts – die Definitionen sind Fachdaten, das Schema kennt sie
> ohnehin nicht. `oasdiff` blieb grün.
>
> **Der Unterschied zu den vier Fällen davor: Diese Änderung meldet sich nicht.** Eine
> Verschärfung äußert sich als 400 an einer Stelle, an der vorher keine war – unangenehm,
> aber sichtbar, und der Aufrufer weiß sofort, dass etwas anders ist. Eine Lockerung äußert
> sich gar nicht: Eine Pflichtangabe, die bisher erzwungen wurde, wird stillschweigend
> nicht mehr erzwungen, und der Datensatz geht durch. Auffallen kann das erst dort, wo das
> Feld gebraucht wird – in einer Auswertung, einer Kapazitätsrechnung, einer Bestellung.
>
> Die Prüfliste aus dem Zielzustand braucht deshalb eine vierte Art von Änderung:
> **entfallene Laufzeitprüfungen.** Sie sind die einzige der vier, für die es beim
> Aufrufer überhaupt kein Signal gibt.
>
> Die Änderung ist hier bewusst und begründet – zwei Definitionen für denselben Schlüssel
> konnten bislang eine unerfüllbare Verbindung ergeben, ohne dass irgendwo ein Fehler
> entstand. Für den Entwicklungsbestand ist sie folgenlos, weil dort kein Schlüssel doppelt
> gepflegt ist. Sie steht hier als Vorgang, nicht als Fehler.

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
