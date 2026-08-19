# Welche Felder dem Aufrufer **vorenthalten** werden (§6, ADR-0030 Punkt 3).
#
# Als Verbotsliste und nicht als Erlaubnisliste, und das ist keine Geschmacksfrage:
# `geltendeDefinitionen` liefert nur **aktive** Definitionen. Eine Erlaubnisliste liesze
# damit jeden Wert verschwinden, dessen Definition ausser Kraft gesetzt wurde - und
# ADR-0012 Punkt 6 haelt deaktivierte Definitionen gerade deshalb, weil bestehende
# Anforderungen Werte tragen, die nur mit ihnen deutbar sind.
#
# Verborgen wird also ausschliesslich, was eine Definition ausdruecklich beschraenkt.
package anforderungen.felder

import rego.v1

verborgen contains definition.key if {
	some definition in input.definitionen
	beschraenkt := object.get(definition, "sichtbarFuer", [])
	count(beschraenkt) > 0
	not trifft(beschraenkt)
}

trifft(rollen) if {
	some rolle in rollen
	rolle in input.benutzer.rollen
}
