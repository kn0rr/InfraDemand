-- Nur lokale Entwicklungsumgebung. Zugangsdaten sind bewusst trivial
-- und verlassen diese Maschine nicht. Produktion: HashiCorp Vault (Abschnitt 13).

CREATE ROLE keycloak WITH LOGIN PASSWORD 'keycloak';
CREATE DATABASE keycloak OWNER keycloak;

CREATE ROLE requirement WITH LOGIN PASSWORD 'requirement';
CREATE DATABASE requirement OWNER requirement;