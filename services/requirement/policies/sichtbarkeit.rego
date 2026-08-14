# Welche Anforderungen ein Aufrufer sehen darf (ADR-0026 Punkt 1, ADR-0028).
#
# Diese Regel ist der Nachweistraeger fuer M5.2: Sie wird nicht ausgewertet, sondern
# *teilausgewertet*. `input.requirement` ist unbekannt; heraus kommt eine Bedingung, die
# in die Abfrage einflieszt.
#
# **Die Pfadnamen unter `input.requirement` sind nicht frei gewaehlt.** Sie erscheinen
# unveraendert im erzeugten Ausdruck (`requirement.tenant`) und verweisen damit auf
# Tabelle und Spalte. Wer sie eindeutscht, erzeugt eine Bedingung auf eine Spalte, die
# es nicht gibt.
package anforderungen.sichtbarkeit

import rego.v1

# Fail-closed schon in der Richtlinie, nicht erst im Client (ADR-0028 Punkt 5).
default sichtbar := false

sichtbar if {
	input.requirement.tenant in input.benutzer.mandanten
}
