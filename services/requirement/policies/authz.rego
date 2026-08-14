# Zugriffsschutz der OPA-Schnittstelle selbst (PROD-058).
#
# Ohne diese Richtlinie ist die Verwaltungs-API offen: Ein unauthentifiziertes
# `PUT /v1/policies/...` ersetzt die Berechtigungsregel und hebt damit die gesamte
# Pruefung auf. Der schreibgeschuetzte Einhaengepunkt schuetzt nicht - er fuettert OPA
# nur beim Start.
package system.authz

import rego.v1

default allow := false

# Der Dienst braucht genau eine Sache: die Teilauswertung der Sichtbarkeit.
allow if {
	input.method == "POST"
	input.path == ["v1", "compile", "anforderungen", "sichtbarkeit", "sichtbar"]
}

# Bereitschaftsanzeige bleibt offen, damit eine Ueberwachung moeglich ist.
allow if {
	input.method == "GET"
	input.path == ["health"]
}
