# Welche Anforderungen ein Aufrufer sehen darf (ADR-0026 Punkt 1, ADR-0028).
#
# Diese Regel ist der Nachweistraeger fuer M5.2: Sie wird nicht ausgewertet, sondern
# *teilausgewertet*. `input.requirement` ist unbekannt; heraus kommt eine Bedingung, die
# in die Abfrage einflieszt.
#
# **Die Pfadnamen unter `input.requirement` sind nicht frei gewaehlt.** Sie erscheinen
# unveraendert im erzeugten Ausdruck und benennen damit ein fachliches Feld. Welche Spalte
# daraus wird, entscheidet die Abbildung im Uebersetzer - fuer den Bestand eine andere als
# fuer die Historie.
# Tabelle und Spalte. Wer sie eindeutscht, erzeugt eine Bedingung auf eine Spalte, die
# es nicht gibt.
package anforderungen.sichtbarkeit

import rego.v1

# Fail-closed schon in der Richtlinie, nicht erst im Client (ADR-0028 Punkt 5).
default sichtbar := false

# Eigene Anforderungen - die Zielgruppe „Anwender" aus §1.
sichtbar if {
	im_mandanten
	input.requirement.owner == input.benutzer.kennung
}

# Der gesamte Bestand des eigenen Mandanten - die Zielgruppe „Plattformbetreiber" aus §1.
sichtbar if {
	im_mandanten
	"platform-admin" in input.benutzer.rollen
}

# Die Mandantengrenze gilt fuer jeden Weg (ADR-0026 Punkt 1). Als eigene Regel, damit sie
# nicht mehrfach dasteht und beim naechsten Zweig vergessen werden kann.
im_mandanten if {
	input.requirement.tenant in input.benutzer.mandanten
}
