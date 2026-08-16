# Prueft die Entscheidung bei *bekannter* Anforderung. Die Teilauswertung - der eigentliche
# Gegenstand von M5.2 - wird daneben im Integrationstest des Dienstes geprueft: Sie
# erzeugt eine Bedingung, und ob die dieselbe Menge liefert wie der Filter aus M5.1, ist
# eine Frage an die Datenbank und nicht an Rego.
package anforderungen.sichtbarkeit_test

import rego.v1

import data.anforderungen.sichtbarkeit.sichtbar

test_eigener_mandant_ist_sichtbar if {
	sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"], "kennung": "anna", "rollen": []},
		"requirement": {"tenant": "t-eins", "owner": "anna"},
	}
}

test_fremder_mandant_ist_nicht_sichtbar if {
	not sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"], "kennung": "anna", "rollen": []},
		"requirement": {"tenant": "t-zwei", "owner": "anna"},
	}
}

test_mehrfachzugehoerigkeit_sieht_beide if {
	sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins", "t-zwei"], "kennung": "anna", "rollen": []},
		"requirement": {"tenant": "t-zwei", "owner": "anna"},
	}
}

# Der Fall, den ein Realm ohne Mapper erzeugt (ADR-0026 Punkt 6).
test_ohne_zugehoerigkeit_ist_nichts_sichtbar if {
	not sichtbar with input as {
		"benutzer": {"mandanten": [], "kennung": "anna", "rollen": []},
		"requirement": {"tenant": "t-eins", "owner": "anna"},
	}
}

# Fehlt der Anspruch ganz, darf die Regel nicht durchlassen und auch nicht abbrechen.
test_fehlender_anspruch_ist_nicht_sichtbar if {
	not sichtbar with input as {
		"benutzer": {},
		"requirement": {"tenant": "t-eins"},
	}
}

# Ein Datensatz ohne Mandanten kann es laut Schema nicht geben (NOT NULL). Sollte er
# doch entstehen, ist „unsichtbar" die einzige vertretbare Antwort.
test_anforderung_ohne_mandant_ist_nicht_sichtbar if {
	not sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"]},
		"requirement": {},
	}
}
test_fremde_anforderung_ist_nicht_sichtbar if {
	not sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"], "kennung": "anna", "rollen": []},
		"requirement": {"tenant": "t-eins", "owner": "bodo"},
	}
}

test_betreiber_sieht_den_ganzen_mandanten if {
	sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"], "kennung": "a.admin", "rollen": ["platform-admin"]},
		"requirement": {"tenant": "t-eins", "owner": "bodo"},
	}
}

test_betreiber_sieht_fremden_mandanten_nicht if {
	not sichtbar with input as {
		"benutzer": {"mandanten": ["t-eins"], "kennung": "a.admin", "rollen": ["platform-admin"]},
		"requirement": {"tenant": "t-zwei", "owner": "bodo"},
	}
}
