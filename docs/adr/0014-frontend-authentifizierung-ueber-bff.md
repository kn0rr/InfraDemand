# ADR-0014: Frontend-Authentifizierung über ein Backend-for-Frontend

- **Status:** Angenommen
- **Datum:** 2026-08-06
- **Betrifft:** CLAUDE.md §3, §4, §12, §13
- **Ersetzt:** [ADR-0013](0013-frontend-zuschnitt-und-zugriffsweg.md) **teilweise** – Punkt 2 (direkter Zugriff des Browsers)
- **Ersetzt durch:** –

## Kontext

[ADR-0013](0013-frontend-zuschnitt-und-zugriffsweg.md) legte fest, dass der Browser die
Service-APIs direkt anspricht. Daraus folgt zwangsläufig, dass das Frontend ein
Zugriffstoken hält – festgehalten als `PROD-041`.

Bei der Bewertung dieses Eintrags vor Beginn von M2 zeigte sich ein Fehler in der
ursprünglichen Begründung. ADR-0013 argumentierte gegen eine vorgelagerte Schicht mit dem
Satz, sie sei „eine weitere Komponente, die gebaut, betrieben, abgesichert und
hochverfügbar gehalten werden muss".

**Diese Annahme trifft nicht zu.** Next.js ist ein Server und wird ohnehin ausgeliefert.
Ein Backend-for-Frontend nutzt eine vorhandene Laufzeit, statt eine neue einzuführen. Der
Kostenvergleich, auf dem die Entscheidung beruhte, war falsch aufgestellt.

## Entscheidung

**1. Next.js ist ein vertraulicher OIDC-Client.**
Die Anmeldung läuft serverseitig über den Authorization Code Flow mit Client-Secret. Der
Realm-Client `frontend` wechselt von öffentlich zu vertraulich.

**2. Der Browser erhält ein `httpOnly`-Sitzungscookie – und nie ein Token.**

**3. Browser-Aufrufe an die Services laufen über Next.js.**
Die Route-Handler reichen die Anfrage mit dem serverseitig gehaltenen Token weiter.

**4. Externe Konsumenten nach §12 rufen die Services weiterhin unmittelbar auf.**
Der BFF ist ausschließlich der Weg des Browsers, nicht ein allgemeines Gateway. Die
Entscheidung gegen ein Gateway für den Maschinenverkehr aus ADR-0013 bleibt bestehen.

**5. Die Sitzung ist zustandslos**, abgelegt in einem verschlüsselten Cookie. Kein
Sitzungsspeicher, keine zusätzliche Infrastruktur.

**6. Das Client-Secret erreicht das Repository nicht.**
Variablenersetzung in `keycloak-config-cli` (`IMPORT_VARSUBSTITUTION_ENABLED=true`), Wert
lokal aus `infra/local/local.env`, später aus Vault. Umzusetzen **bevor** der vertrauliche
Client zum ersten Mal angewandt wird – siehe `PROD-012`.

## Begründung

**Der Sicherheitsgewinn ist der einzige, der sich nicht nachrüsten lässt.** Alle übrigen
Vorteile eines Gateways – zentrale Policy, Aggregation, Ratenbegrenzung – sind Betriebs-
fragen und jederzeit nachholbar. Ein Token, das ein Jahr lang im Browser lag und
abgeflossen ist, lässt sich nicht zurückholen.

**Drei Einträge der Produktionsreife entschärfen sich mit derselben Maßnahme:**

| Eintrag | Wirkung |
|---|---|
| `PROD-041` Token im Browser | entfällt |
| `PROD-007` CORS je Service | entfällt für den Browser-Pfad; bleibt für §12 |
| `PROD-006` Netzwerkrichtlinien | Services müssen für den Browser nicht erreichbar sein |

**Zustandslose Sitzung statt Sitzungsspeicher**, weil ein Speicher eine weitere Komponente
wäre – und das ist genau das Argument, das oben widerlegt wurde und hier tatsächlich
zutrifft.

## Was diese Entscheidung **nicht** leistet

Ein `httpOnly`-Cookie verhindert, dass Schadcode im Browser ein Token **entwendet**. Es
verhindert nicht, dass er die Sitzung **benutzt**: Das Cookie wird bei jeder Anfrage
automatisch mitgeschickt, auch bei einer, die ein eingeschleustes Skript auslöst.

Der Unterschied ist trotzdem erheblich:

| | Token im Browser | Sitzungscookie |
|---|---|---|
| Angreifer erhält | ein Token | nichts Mitnehmbares |
| Nutzbar | überall, bis zum Ablauf, auch später | nur im Browser des Opfers, nur solange die Seite offen ist |
| Nachweisbar | kaum | über die Sitzung zuordenbar |

**Die Content Security Policy aus `PROD-033` bleibt damit erforderlich.** Der BFF senkt
den Schaden eines XSS-Fundes, er beseitigt ihn nicht.

## Betrachtete Alternativen

### SPA mit PKCE, Token nur im Arbeitsspeicher

Weniger bewegliche Teile, kein zusätzlicher Sprung, bleibt bei ADR-0013.

Nicht gewählt: Ein erfolgreicher XSS-Angriff liefert ein Token für alle Services, gegen
die das Frontend arbeitet. Die Abwehr besteht ausschließlich darin, dass kein XSS gelingt
– eine Annahme, die über die Laufzeit einer Plattform mit vielen Frontend-Abhängigkeiten
nicht trägt.

### Sitzungsspeicher statt verschlüsseltem Cookie

Erlaubt sofortigen Widerruf einer Sitzung und umgeht Größenbegrenzungen.

Vertagt, nicht verworfen. Erforderlich, sobald ein Widerrufsverfahren gebraucht wird oder
das Cookie an die Größengrenze stößt.

## Konsequenzen

### Positiv

- Im Browser liegt kein Token.
- Ein Ursprung statt vieler – CORS entfällt für den Browser-Pfad.
- Die Services müssen für die Oberfläche nicht öffentlich erreichbar sein.
- Ein natürlicher Ort für Ratenbegrenzung und einheitliche Fehlerbehandlung in Richtung
  Oberfläche.

### Negativ und Risiken

- **Der Next.js-Server wird kritischer Pfad.** Fällt er aus, ist nicht nur die Darstellung
  weg, sondern auch der Zugang zu den Daten. Braucht dieselben Verfügbarkeitsüberlegungen
  wie ein fachlicher Service.
- **Ein zusätzlicher Sprung je Aufruf.**
- **Ein Client-Secret entsteht** und muss von Anfang an außerhalb des Repositories liegen.
  In einem öffentlichen Repository ist das keine Feinheit.
- **Cookie-Größe.** Ein verschlüsselter Sitzungsinhalt mit Zugriffs- und Erneuerungstoken
  kann die 4-KB-Grenze überschreiten. Aufteilung auf mehrere Cookies ist möglich, aber ein
  Hinweis darauf, dass ein Sitzungsspeicher fällig wird.
- **Kein Schutz gegen die Nutzung der Sitzung durch eingeschleusten Code** – siehe oben.

## Folgeentscheidungen

| Frage | Wann |
|---|---|
| Variablenersetzung für das Client-Secret | **M2.1**, vor dem ersten Import des vertraulichen Clients |
| Bibliothek für die serverseitige Anmeldung | M2.2 |
| Zuschnitt des Weiterleitungspfads: allgemeiner Durchreicher oder Route je Anwendungsfall | M2.3 |
| Sitzungsspeicher statt Cookie | bei Widerrufsbedarf oder Größenproblem |
| Verfügbarkeit des Next.js-Servers | vor der ersten produktionsnahen Umgebung |
