-- Nur lokale Entwicklungsumgebung. Zugangsdaten sind bewusst trivial
-- und verlassen diese Maschine nicht. Produktion: HashiCorp Vault (Abschnitt 13).

-- ACHTUNG: Diese Zugangsdaten muessen mit infra/local/local.env uebereinstimmen.
-- SQL kann keine Umgebungsvariablen lesen - das ist die einzige Stelle, an der die
-- Werte notwendigerweise ein zweites Mal stehen.
CREATE ROLE keycloak WITH LOGIN PASSWORD 'keycloak';
CREATE DATABASE keycloak OWNER keycloak;

CREATE ROLE requirement WITH LOGIN PASSWORD 'requirement';
CREATE DATABASE requirement OWNER requirement;
