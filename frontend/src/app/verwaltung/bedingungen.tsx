"use client";

import {
  ActionIcon,
  Autocomplete,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { components } from "@/lib/api/schema";

type Bedingung = components["schemas"]["WorkflowBedingungDto"];
type Vergleich = components["schemas"]["VergleichDto"];
type Bedingungsart = Bedingung["art"];
export type Operator = Vergleich["operator"];
type Vergleichswert = Vergleich["wert"];

const ARTEN: { value: Bedingungsart; label: string }[] = [
  { value: "rolle", label: "Rolle verlangt" },
  { value: "vier_augen", label: "Vier-Augen-Prinzip" },
  { value: "identitaet", label: "Nur die genannte Person" },
  { value: "pflichtfelder", label: "Pflichtfelder" },
  { value: "feldwert", label: "Feldwert" },
  { value: "begruendung", label: "Begruendung verlangt" },
];

const OPERATOREN: { value: Operator; label: string }[] = [
  { value: "istGleich", label: "ist gleich" },
  { value: "istUngleich", label: "ist ungleich" },
  { value: "mindestens", label: "mindestens" },
  { value: "hoechstens", label: "hoechstens" },
  { value: "istEinesVon", label: "ist eines von" },
  { value: "istGefuellt", label: "ist gefuellt" },
];

/**
 * Wechselt die Art einer Bedingung.
 *
 * **Es bleiben nur Art und Vorbehalt.** Die uebrigen Felder gehoeren zur alten Art; sie
 * mitzuschleppen hiesse, dass ein `eineVon` an einer `pflichtfelder`-Bedingung haengt - der
 * Dienst ignoriert es, aber es steht in der gespeicherten Definition und verwirrt jeden,
 * der sie spaeter oeffnet.
 *
 * Der Vorbehalt bleibt, weil er von der Art unabhaengig ist: „nur wenn die Kategorie nicht
 * Cloud ist" gilt fuer jede Anforderung gleichermassen.
 */
export function wechsleArt(bedingung: Bedingung, art: Bedingungsart): Bedingung {
  return { art, nurWenn: bedingung.nurWenn };
}

/**
 * Deutet die Eingabe nach dem Operator.
 *
 * Ein einzelnes Textfeld statt eines je Typ - dieselbe Ueberlegung wie bei
 * `deuteVorgabewert`. Was nicht passt, weist die Graphpruefung beim Speichern ab, und sie
 * nennt die Fundstelle.
 */
export function deuteWert(eingabe: string, operator: Operator): Vergleichswert {
  const wert = eingabe.trim();

  if (operator === "istGefuellt") {
    return wert === "true";
  }

  if (operator === "istEinesVon") {
    return wert
      .split(",")
      .map((eintrag) => eintrag.trim())
      .filter((eintrag) => eintrag !== "");
  }

  if (operator === "mindestens" || operator === "hoechstens") {
    const zahl = Number(wert);
    // Zeichenkette bleibt Zeichenkette: ISO-Datumsangaben sortieren lexikografisch richtig.
    return wert !== "" && Number.isFinite(zahl) ? zahl : wert;
  }

  if (wert === "true" || wert === "false") {
    return wert === "true";
  }

  const zahl = Number(wert);
  return wert !== "" && Number.isFinite(zahl) ? zahl : wert;
}

/** Umkehrung fuer die Anzeige. Listen als Kommafolge, alles andere als Text. */
export function zeigeWert(wert: unknown): string {
  if (Array.isArray(wert)) {
    return wert.map((eintrag) => String(eintrag)).join(", ");
  }

  return wert === undefined || wert === null ? "" : String(wert);
}

interface Eigenschaften {
  geoeffnet: boolean;
  schliessen: () => void;
  uebergang: string;
  bedingungen: Bedingung[];
  aendern: (bedingungen: Bedingung[]) => void;
  zustaende: { key: string; label: string }[];
  feldnamen: string[];
}

export function Bedingungseditor({
  geoeffnet,
  schliessen,
  uebergang,
  bedingungen,
  aendern,
  zustaende,
  feldnamen,
}: Eigenschaften) {
  const ersetze = (index: number, teil: Partial<Bedingung>) =>
    aendern(bedingungen.map((eintrag, i) => (i === index ? { ...eintrag, ...teil } : eintrag)));

  const vergleicheAendern = (index: number, vergleiche: Vergleich[]) =>
    ersetze(index, { nurWenn: vergleiche });

  return (
    <Modal opened={geoeffnet} onClose={schliessen} title={`Bedingungen: ${uebergang}`} size="xl">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Alle Bedingungen muessen erfuellt sein. <strong>Ein ODER entsteht von selbst:</strong>{" "}
          Zwei Bedingungen mit derselben Anforderung und verschiedenen Vorbehalten wirken wie „das
          eine oder das andere".
        </Text>

        {bedingungen.length === 0 ? (
          <Text size="sm" c="dimmed">
            Keine Bedingungen – dieser Uebergang steht jedem offen, der die Anforderung sieht.
          </Text>
        ) : null}

        {bedingungen.map((bedingung, index) => (
          <Paper key={index} withBorder p="sm" radius="sm">
            <Stack gap="xs">
              <Group align="flex-end" gap="xs">
                <Select
                  label="Art"
                  data={ARTEN}
                  allowDeselect={false}
                  value={bedingung.art}
                  // Beim Wechsel bleibt nur die Art und der Vorbehalt: Die uebrigen Felder
                  // gehoeren zur alten Art und waeren dort sinnlos.
                  onChange={(wert) =>
                    aendern(
                      bedingungen.map((eintrag, i) =>
                        i === index
                          ? wechsleArt(eintrag, (wert ?? "rolle") as Bedingungsart)
                          : eintrag,
                      ),
                    )
                  }
                  w={220}
                />

                {bedingung.art === "rolle" ? (
                  <TextInput
                    label="Rollen"
                    description="Eine davon genuegt, mit Komma getrennt"
                    style={{ flex: 1 }}
                    value={(bedingung.eineVon ?? []).join(", ")}
                    onChange={(ereignis) =>
                      ersetze(index, {
                        eineVon: ereignis.currentTarget.value
                          .split(",")
                          .map((eintrag) => eintrag.trim())
                          .filter((eintrag) => eintrag !== ""),
                      })
                    }
                  />
                ) : null}

                {bedingung.art === "vier_augen" ? (
                  <Select
                    label="Andere Person als bei Eintritt in"
                    description="Muss auf jedem Weg hierher liegen"
                    data={zustaende.map((zustand) => ({
                      value: zustand.key,
                      label: `${zustand.label} (${zustand.key})`,
                    }))}
                    style={{ flex: 1 }}
                    value={bedingung.andersAlsBeiEintritt ?? null}
                    onChange={(wert) => ersetze(index, { andersAlsBeiEintritt: wert ?? undefined })}
                  />
                ) : null}

                {bedingung.art === "identitaet" ? (
                  <Autocomplete
                    label="Feld mit der Person"
                    data={feldnamen}
                    style={{ flex: 1 }}
                    value={bedingung.feld ?? ""}
                    onChange={(wert) => ersetze(index, { feld: wert })}
                  />
                ) : null}

                {bedingung.art === "pflichtfelder" ? (
                  <TextInput
                    label="Felder"
                    description="Mit Komma getrennt"
                    style={{ flex: 1 }}
                    value={(bedingung.felder ?? []).join(", ")}
                    onChange={(ereignis) =>
                      ersetze(index, {
                        felder: ereignis.currentTarget.value
                          .split(",")
                          .map((eintrag) => eintrag.trim())
                          .filter((eintrag) => eintrag !== ""),
                      })
                    }
                  />
                ) : null}

                {bedingung.art === "begruendung" ? (
                  <NumberInput
                    label="Mindestlaenge"
                    min={1}
                    w={160}
                    value={bedingung.mindestlaenge ?? 1}
                    onChange={(wert) =>
                      ersetze(index, { mindestlaenge: typeof wert === "number" ? wert : 1 })
                    }
                  />
                ) : null}

                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Bedingung entfernen"
                  onClick={() => aendern(bedingungen.filter((_, i) => i !== index))}
                >
                  ×
                </ActionIcon>
              </Group>

              {bedingung.art === "feldwert" ? (
                <Group align="flex-end" gap="xs">
                  <Autocomplete
                    label="Feld"
                    data={feldnamen}
                    value={bedingung.feld ?? ""}
                    onChange={(wert) => ersetze(index, { feld: wert })}
                  />
                  <Select
                    label="Vergleich"
                    data={OPERATOREN}
                    allowDeselect={false}
                    value={bedingung.operator ?? "istGleich"}
                    onChange={(wert) =>
                      ersetze(index, { operator: (wert ?? "istGleich") as Operator })
                    }
                    w={180}
                  />
                  <TextInput
                    label="Wert"
                    style={{ flex: 1 }}
                    value={zeigeWert(bedingung.wert)}
                    onChange={(ereignis) =>
                      ersetze(index, {
                        wert: deuteWert(
                          ereignis.currentTarget.value,
                          bedingung.operator ?? "istGleich",
                        ),
                      })
                    }
                  />
                </Group>
              ) : null}

              <Divider label="Gilt nur, wenn" labelPosition="left" />

              {(bedingung.nurWenn ?? []).map((vergleich, nummer) => (
                <Group key={nummer} align="flex-end" gap="xs">
                  <Autocomplete
                    label="Feld"
                    data={feldnamen}
                    value={vergleich.feld}
                    onChange={(wert) =>
                      vergleicheAendern(
                        index,
                        (bedingung.nurWenn ?? []).map((eintrag, i) =>
                          i === nummer ? { ...eintrag, feld: wert } : eintrag,
                        ),
                      )
                    }
                  />
                  <Select
                    label="Vergleich"
                    data={OPERATOREN}
                    allowDeselect={false}
                    value={vergleich.operator}
                    onChange={(wert) =>
                      vergleicheAendern(
                        index,
                        (bedingung.nurWenn ?? []).map((eintrag, i) =>
                          i === nummer
                            ? { ...eintrag, operator: (wert ?? "istGleich") as Operator }
                            : eintrag,
                        ),
                      )
                    }
                    w={180}
                  />
                  <TextInput
                    label="Wert"
                    style={{ flex: 1 }}
                    value={zeigeWert(vergleich.wert)}
                    onChange={(ereignis) =>
                      vergleicheAendern(
                        index,
                        (bedingung.nurWenn ?? []).map((eintrag, i) =>
                          i === nummer
                            ? {
                                ...eintrag,
                                wert: deuteWert(ereignis.currentTarget.value, eintrag.operator),
                              }
                            : eintrag,
                        ),
                      )
                    }
                  />
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Vorbehalt entfernen"
                    onClick={() =>
                      vergleicheAendern(
                        index,
                        (bedingung.nurWenn ?? []).filter((_, i) => i !== nummer),
                      )
                    }
                  >
                    ×
                  </ActionIcon>
                </Group>
              ))}

              <Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    vergleicheAendern(index, [
                      ...(bedingung.nurWenn ?? []),
                      { feld: "", operator: "istGleich", wert: "" },
                    ])
                  }
                >
                  Vorbehalt hinzufuegen
                </Button>
              </Group>
            </Stack>
          </Paper>
        ))}

        <Group justify="space-between">
          <Button
            variant="light"
            onClick={() => aendern([...bedingungen, { art: "rolle", eineVon: [] }])}
          >
            Bedingung hinzufuegen
          </Button>
          <Button onClick={schliessen}>Fertig</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
