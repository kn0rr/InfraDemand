# ADR-0015: Mehrere Identitätsquellen über Brokering statt mehrerer Aussteller

- **Status:** Angenommen
- **Datum:** 2026-08-06
- **Betrifft:** CLAUDE.md §5 (Identity & Access Service), §8, §15, §19.3
- **Ersetzt:** –
- **Ersetzt durch:** –

## Kontext

Vor Beginn von M2.3 – der serverseitigen Anmeldung nach
[ADR-0014](0014-frontend-authentifizierung-ueber-bff.md) – kam die Anforderung hinzu, dass
Anwender aus **mehreren Identitätsquellen** stammen können: mehrere Keycloak-Instanzen,
Active Directory, möglicherweise weitere Verzeichnisse.

Bisher gingen alle Festlegungen von genau einem Aussteller aus. Der Realm `infrademand`
ist in [ADR-0004](0004-authentifizierung-und-autorisierung.md) als Ausstellungsstelle
gesetzt, `services/requirement/src/auth/jwt.strategy.ts` prüft gegen genau einen
`issuer` und einen JWKS-Endpunkt.

Drei bereits getroffene Festlegungen hängen unmittelbar an der Identität:

- §8 bindet Berechtigungen an Rolle **und** Objektbezug – die Identität ist der Schlüssel
- §19.3 macht die Herkunft einer Schreiboperation zur Eingabe der Schreibentscheidung
- §15 fordert Mandantenfähigkeit

Die Frage ist deshalb nicht, wie sich mehrere Anmeldeknöpfe darstellen lassen. Sie lautet:
**Kennt die Anwendung N Aussteller, oder kennt sie einen Aussteller, der N Quellen
kennt?**

## Entscheidung

**1. Der Realm `infrademand` bleibt der einzige Aussteller gegenüber der Anwendung.**
Weitere Identitätsquellen werden **in** ihm angebunden, nicht neben ihm betrieben:

| Quelle | Anbindung in Keycloak |
|---|---|
| Weitere Keycloak-Instanz | Identity Provider, OIDC |
| Entra ID (Azure AD) | Identity Provider, OIDC |
| ADFS | Identity Provider, OIDC oder SAML |
| Active Directory vor Ort | User Federation, LDAP (optional Kerberos) |

**2. Die Auswahl der Quelle ist Sache von Keycloak, nicht des Frontends.**
Die Anmeldeseite zeigt die konfigurierten Quellen. Ist die Zielquelle bereits bekannt,
reicht der BFF `kc_idp_hint=<alias>` durch. Eine Zuordnung über die E-Mail-Domäne leistet
die Funktion *Organizations* ab Keycloak 26.

**3. Kein Code darf voraussetzen, dass es genau einen Aussteller gibt.**
Das gilt für den BFF **und** für die Tokenprüfung der Services. Der Aussteller wird über
eine Auflösungsfunktion beschafft, nicht aus einer Konstanten gelesen. Heute liefert diese
Funktion genau einen Eintrag.

**4. Die auslösende Bedingung für den Wechsel auf mehrere Aussteller ist benannt.**
Sobald eine der folgenden Bedingungen eintritt, wird diese Entscheidung durch ein neues
ADR abgelöst:

- Ein Mandant besteht auf einem eigenen Realm, weil Benutzerdaten seine Grenze nicht
  verlassen dürfen
- Rollen- oder Attributnamen kollidieren zwischen Mandanten unauflösbar
- Die Ausfallwirkung eines gemeinsamen Realms wird als nicht tragbar bewertet

**5. Die ursprüngliche Quelle ist im Token sichtbar.**
Ein Protocol Mapper führt den Alias der Ursprungsquelle als Anspruch mit. Ohne ihn ist
nach der Vermittlung nicht mehr erkennbar, woher eine Identität stammt – und §19.3
verlangt genau diese Auskunft.

## Begründung

**Vermittlung hält die Identität eindeutig; mehrere Aussteller zersplittern sie.**
Bei N Ausstellern ist dieselbe Person, die in zwei Verzeichnissen geführt wird, zwei
Subjekte mit zwei Bezeichnern. Jede Berechtigung nach §8 und jeder Herkunftsnachweis nach
§19.3 müsste dann eine Zusammenführung mitdenken. Bei Vermittlung entsteht genau **ein**
lokaler Benutzer mit **einem** stabilen `sub`, gleich über welche Quelle er sich anmeldet.
Diese Eindeutigkeit ist nachträglich nicht herstellbar: Sind erst einmal Anforderungen,
Freigaben und Versionsstände gegen zwei Bezeichner derselben Person geschrieben, ist die
Historie nicht mehr sauber zusammenzuführen.

**Die Kosten fallen einmal an, nicht je Service.** Bei mehreren Ausstellern braucht jeder
Service Schlüsselbeschaffung, Zielgruppenprüfung und Rollenabbildung je Aussteller – und
zwar auf Dauer, für jeden künftigen Service. Bei Vermittlung passiert das einmal, an einer
Stelle, in Konfiguration statt in Code.

**Rollenabbildung gehört ohnehin an eine Stelle.** Ein AD liefert Gruppen, keine
Anwendungsrollen. Die Übersetzung `AD-Gruppe → requirement-author` muss irgendwo
stattfinden. In Keycloak ist sie Konfiguration und über `keycloak-config-cli` versioniert;
in den Services wäre sie verstreuter Code.

**Es passt zu dem, was ohnehin gebaut wird.** §5 sieht einen Identity & Access Service als
eigene fachliche Verantwortung vor. Die Quellen dort zu bündeln, ist die Umsetzung dieser
Vorgabe – nicht eine Abweichung davon.

## Betrachtete Alternativen

### Mehrere Aussteller, aufgelöst im BFF und in jedem Service

Der BFF kennt N Aussteller, führt den Code Flow gegen den gewählten und reicht dessen
Token weiter. Jeder Service prüft gegen N Aussteller.

Vorteile: harte Trennung je Mandant, kein gemeinsamer Ausfallpunkt, ein Mandant kann seine
Instanz selbst betreiben.

**Nicht gewählt**, weil die Identität zersplittert (siehe Begründung) und die Kosten je
Service dauerhaft anfallen. Der Vorteil – harte Mandantentrennung – ist heute nicht
gefordert; §15 verlangt Mandantenfähigkeit, nicht getrennte Identitätsverwaltungen. Wenn
er gefordert wird, greift Punkt 4.

### Ein Aussteller je Mandant, Auswahl über die Subdomäne

Zwischenform: nicht beliebig viele Aussteller, sondern genau einer je Mandant, ermittelt
aus dem Aufrufnamen (`kunde-a.infrademand.example`).

Vorteile: die Auflösung ist trivial und ohne Auswahlseite.

**Nicht gewählt**, weil sie dieselben Nachteile wie die erste Alternative hat, sobald ein
Anwender für zwei Mandanten arbeitet – ein Fall, den eine Plattform für
Anforderungsmanagement über Organisationsgrenzen hinweg erwarten muss. Bleibt als
Darstellungsvariante *innerhalb* der gewählten Lösung verfügbar: die Subdomäne kann
`kc_idp_hint` setzen.

### Anmeldung unmittelbar gegen Active Directory, ohne Keycloak

**Nicht gewählt.** AD vor Ort spricht LDAP und Kerberos, nicht OIDC. Ohne einen davor
gesetzten Aussteller müsste die Anwendung Kennwörter selbst entgegennehmen – ein
unmittelbarer Widerspruch zu §13 und zu ADR-0004.

## Konsequenzen

### Positiv

- Die Tokenprüfung der Services bleibt unverändert einfach: ein Aussteller, ein JWKS
- Eine neue Quelle ist eine Konfigurationsänderung in `infra/keycloak/realms/`, kein
  Deployment eines Service
- Anmeldung über mehrere Quellen ist im BFF **kein Sonderfall** – er sieht immer denselben
  Ablauf
- Die Auswahloberfläche, Zuordnung über E-Mail-Domäne, Kontoverknüpfung und die Behandlung
  gleicher E-Mail-Adressen aus zwei Quellen sind gelöste Keycloak-Funktionen und müssen
  nicht selbst gebaut werden

### Negativ

- **Der Realm ist ein gemeinsamer Ausfall- und Wirkbereich.** Fällt er aus, kommt niemand
  mehr hinein. Erfasst als `PROD-042`
- **Abmeldung über die Vermittlungsgrenze ist unvollständig.** Eine Abmeldung bei uns
  beendet die Sitzung bei der Ursprungsquelle nicht zuverlässig. Erfasst als `PROD-043`
- **Vermittelte Merkmale sind nur so aktuell wie die letzte Anmeldung.** Wird ein Konto im
  AD deaktiviert, wirkt das erst beim nächsten Anmelde- oder Erneuerungsversuch, nicht
  sofort. Erfasst als `PROD-044`
- Punkt 3 erzeugt eine Indirektion, die heute keinen sichtbaren Nutzen hat. Das ist
  beabsichtigt und der Preis dafür, Punkt 4 später nicht als Umbau zu bezahlen

### Offen

- ~~Ob ein Mandant im Sinne von §15 einer Keycloak-*Organization*, einer Gruppe oder einem
  eigenen Realm entspricht~~

> **Beantwortet am 2026-08-06 durch
> [ADR-0017](0017-regelvokabular-der-datenhoheit-und-mandantenbegriff.md) Teil C.**
>
> Der Mandant ist **keines von dreien**: Er ist eine fachliche Entität der Plattform, kein
> Keycloak-Objekt. Er trägt Bezeichnung, Kostenstellen und Zuständigkeiten und wird vom
> Identity & Access Service geführt (§5). Keycloak stellt ausschließlich die
> **Zugehörigkeit** fest und liefert sie als Anspruch im Token; technisch bildet eine
> *Organization* darauf ab. Die Verbindung ist ein Bezeichner, sonst nichts.
>
> Das ist die Fortsetzung der hier getroffenen Entscheidung, nicht eine Abweichung davon:
> Lägen die fachlichen Mandantendaten in Keycloak, nähme ein Wechsel des
> Identitätsanbieters sie mit – und die Austauschbarkeit, um die es diesem ADR geht, wäre
> an anderer Stelle wieder verloren.
>
> Bestätigt wird außerdem, dass ein Anwender **mehreren Mandanten angehören kann** – der
> Fall, mit dem hier bereits gegen die Auflösung über Subdomänen argumentiert wurde. Wie
> der wirksame Mandant dann gewählt wird, ist zu M5 vertagt.
