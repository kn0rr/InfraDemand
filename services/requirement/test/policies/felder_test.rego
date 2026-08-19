package anforderungen.felder_test

import rego.v1

import data.anforderungen.felder.verborgen

eingabe(rollen) := {
	"benutzer": {"rollen": rollen},
	"definitionen": [
		{"key": "prio"},
		{"key": "frei", "sichtbarFuer": []},
		{"key": "kosten", "sichtbarFuer": ["controller"]},
	],
}

test_ohne_angabe_nicht_verborgen if {
	# Der Bestandsfall: Was es vor dieser Spalte gab, bleibt sichtbar.
	not "prio" in verborgen with input as eingabe(["requirement-author"])
}

test_leere_liste_ist_wie_keine_angabe if {
	not "frei" in verborgen with input as eingabe(["requirement-author"])
}

test_beschraenktes_attribut_ohne_rolle_verborgen if {
	"kosten" in verborgen with input as eingabe(["requirement-author"])
}

test_beschraenktes_attribut_mit_rolle_nicht_verborgen if {
	not "kosten" in verborgen with input as eingabe(["controller"])
}

test_ohne_definitionen_ist_nichts_verborgen if {
	# Der Fall, der ohne Definitionen entsteht - und der belegt, dass die Regel nicht
	# pauschal verbirgt.
	verborgen == set() with input as {"benutzer": {"rollen": []}, "definitionen": []}
}
