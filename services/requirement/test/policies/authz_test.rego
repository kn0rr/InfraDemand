package system.authz_test

import rego.v1

import data.system.authz.allow

test_teilauswertung_ist_erlaubt if {
	allow with input as {
		"method": "POST",
		"path": ["v1", "compile", "anforderungen", "sichtbarkeit", "sichtbar"],
	}
}

# Der Angriff aus PROD-058, als Test festgehalten.
test_richtlinie_ersetzen_ist_verboten if {
	not allow with input as {
		"method": "PUT",
		"path": ["v1", "policies", "sichtbarkeit.rego"],
	}
}

test_quelltext_lesen_ist_verboten if {
	not allow with input as {"method": "GET", "path": ["v1", "policies"]}
}

test_daten_schreiben_ist_verboten if {
	not allow with input as {"method": "PUT", "path": ["v1", "data", "x"]}
}

# Freigegeben ist ein Pfad, nicht "Auswertung allgemein".
test_fremder_auswertungspfad_ist_verboten if {
	not allow with input as {"method": "POST", "path": ["v1", "compile", "irgendwas"]}
}

test_bereitschaft_ist_erlaubt if {
	allow with input as {"method": "GET", "path": ["health"]}
}
test_feldsichtbarkeit_ist_erlaubt if {
	allow with input as {
		"method": "POST",
		"path": ["v1", "data", "anforderungen", "felder", "verborgen"],
	}
}
