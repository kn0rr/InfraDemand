"use client";

import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import type { components } from "@/lib/api/schema";
import {
  useFassungsnutzung,
  useWorkflowAendern,
  useWorkflowAnlegen,
  useWorkflows,
  type Workflow,
} from "@/lib/api/workflows";

type Bedingung = components["schemas"]["WorkflowBedingungDto"];

interface Formularwerte {
  id: string | null;
  label: string;
  requirementType: string;
  mode: "internal" | "external";
  active: boolean;
  initialState: string;
  states: { key: string; label: string; final: boolean }[];
  /** `bedingungen` wird durchgereicht, nicht bearbeitet - siehe unten. */
  transitions: { from: string; to: string; label: string; bedingungen: Bedingung[] }[];
}

const LEER: Formularwerte = {
  id: null,
  label: "",
  requirementType: "",
  mode: "internal",
  active: true,
  initialState: "",
  states: [{ key: "neu", label: "Neu", final: false }],
  transitions: [],
};

export function Workflows() {
  const workflows = useWorkflows();
  const anlegen = useWorkflowAnlegen();
  const aendern = useWorkflowAendern();

  /**
   * Bewusst **nicht** `mode: "uncontrolled"` wie die uebrigen Formulare hier.
   *
   * Die Auswahllisten fuer Anfangszustand und Uebergaenge speisen sich aus der
   * Zustandsliste: Wer einen Zustand hinzufuegt, muss ihn unmittelbar danach auswaehlen
   * koennen. Ohne Neuzeichnen bei jeder Aenderung waere die Auswahl veraltet.
   */
  const formular = useForm<Formularwerte>({ initialValues: LEER });

  const nutzung = useFassungsnutzung(formular.values.id);
  const zustandsauswahl = formular.values.states
    .filter((zustand) => zustand.key.trim() !== "")
    .map((zustand) => ({ value: zustand.key, label: `${zustand.label} (${zustand.key})` }));

  const uebernehmen = (workflow: Workflow) => {
    formular.setValues({
      id: workflow.id,
      label: workflow.label,
      requirementType: workflow.requirementType ?? "",
      mode: workflow.mode,
      active: workflow.active,
      initialState: workflow.initialState,
      states: workflow.states.map((zustand) => ({ ...zustand })),
      // Die Bedingungen wandern mit in den Formularzustand und unveraendert zurueck.
      transitions: workflow.transitions.map((uebergang) => ({
        from: uebergang.from,
        to: uebergang.to,
        label: uebergang.label,
        bedingungen: uebergang.bedingungen,
      })),
    });
  };

  const speichern = (werte: Formularwerte) => {
    const graph = {
      label: werte.label,
      initialState: werte.initialState,
      states: werte.states,
      transitions: werte.transitions,
      mode: werte.mode,
    };

    if (werte.id === null) {
      anlegen.mutate(
        {
          ...graph,
          ...(werte.requirementType === "" ? {} : { requirementType: werte.requirementType }),
        },
        { onSuccess: () => formular.setValues(LEER) },
      );
      return;
    }

    // `requirementType` fehlt bewusst: Er bezeichnet, wofuer der Workflow gilt, und ist
    // unveraenderlich (ADR-0022).
    aendern.mutate({ id: werte.id, ...graph, active: werte.active });
  };

  const fehler = anlegen.error ?? aendern.error;

  return (
    <Stack gap="lg" pt="md">
      <Paper withBorder p="md" radius="md">
        <form onSubmit={formular.onSubmit(speichern)}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Title order={3} size="h5">
                {formular.values.id === null ? "Workflow anlegen" : "Workflow aendern"}
              </Title>
              {formular.values.id === null ? null : (
                <Button variant="subtle" size="xs" onClick={() => formular.setValues(LEER)}>
                  Neu beginnen
                </Button>
              )}
            </Group>

            <Group grow align="flex-start">
              <TextInput label="Bezeichnung" {...formular.getInputProps("label")} />
              <TextInput
                label="Anforderungsart"
                description="Leer: gilt fuer alle Arten ohne eigenen Workflow"
                disabled={formular.values.id !== null}
                {...formular.getInputProps("requirementType")}
              />
            </Group>

            <Group grow align="flex-start">
              <Select
                label="Betriebsart"
                description="external: ein Fremdsystem fuehrt, der Graph beschreibt nur"
                data={[
                  { value: "internal", label: "eigengefuehrt" },
                  { value: "external", label: "fremdgefuehrt" },
                ]}
                allowDeselect={false}
                {...formular.getInputProps("mode")}
              />
              <Select
                label="Anfangszustand"
                data={zustandsauswahl}
                {...formular.getInputProps("initialState")}
              />
            </Group>

            {formular.values.id === null ? null : (
              <Switch
                label="Aktiv"
                description="Ausgeschaltet entstehen keine neuen Anforderungen mehr; laufende laufen weiter (ADR-0025)"
                checked={formular.values.active}
                onChange={(ereignis) =>
                  formular.setFieldValue("active", ereignis.currentTarget.checked)
                }
              />
            )}

            <Title order={4} size="h6" pt="sm">
              Zustaende
            </Title>

            {formular.values.states.map((_zustand, index) => (
              // Der Index als Schluessel ist hier vertretbar: Die Liste wird nur am Ende
              // erweitert und einzeln geleert, nicht umsortiert.
              <Group key={index} align="flex-end" gap="xs">
                <TextInput
                  label="Schluessel"
                  placeholder="in_pruefung"
                  {...formular.getInputProps(`states.${index}.key`)}
                />
                <TextInput
                  label="Bezeichnung"
                  placeholder="In Pruefung"
                  {...formular.getInputProps(`states.${index}.label`)}
                />
                <Checkbox
                  label="Endzustand"
                  pb={8}
                  {...formular.getInputProps(`states.${index}.final`, { type: "checkbox" })}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => formular.removeListItem("states", index)}
                  aria-label="Zustand entfernen"
                >
                  ×
                </ActionIcon>
              </Group>
            ))}

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  formular.insertListItem("states", { key: "", label: "", final: false })
                }
              >
                Zustand hinzufuegen
              </Button>
            </Group>

            <Title order={4} size="h6" pt="sm">
              Uebergaenge
            </Title>

            {formular.values.transitions.map((uebergang, index) => (
              <Group key={index} align="flex-end" gap="xs">
                <Select
                  label="Von"
                  data={zustandsauswahl}
                  {...formular.getInputProps(`transitions.${index}.from`)}
                />
                <Select
                  label="Nach"
                  data={zustandsauswahl}
                  {...formular.getInputProps(`transitions.${index}.to`)}
                />
                <TextInput
                  label="Beschriftung"
                  placeholder="Einreichen"
                  {...formular.getInputProps(`transitions.${index}.label`)}
                />
                <Text size="xs" c="dimmed" pb={10}>
                  {uebergang.bedingungen.length === 0
                    ? "keine Bedingungen"
                    : `${uebergang.bedingungen.length} Bedingungen`}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => formular.removeListItem("transitions", index)}
                  aria-label="Uebergang entfernen"
                >
                  ×
                </ActionIcon>
              </Group>
            ))}

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  formular.insertListItem("transitions", {
                    from: "",
                    to: "",
                    label: "",
                    bedingungen: [],
                  })
                }
              >
                Uebergang hinzufuegen
              </Button>
            </Group>

            <Text size="xs" c="dimmed">
              Bedingungen an Uebergaengen – Rolle, Vier-Augen-Prinzip, Pflichtfelder – bleiben beim
              Speichern unveraendert erhalten, sind hier aber noch nicht bearbeitbar.
            </Text>

            {fehler === null ? null : (
              <Alert color="red" title="Nicht gespeichert">
                {fehler.message}
              </Alert>
            )}

            {nutzung.data === undefined || nutzung.data.length === 0 ? null : (
              <Alert color="blue" title="Anforderungen auf dieser Definition">
                {nutzung.data
                  .map(
                    (eintrag) =>
                      `Fassung ${eintrag.version}: ${eintrag.requirements}${eintrag.current ? " (aktuell)" : ""}`,
                  )
                  .join(" · ")}
                {nutzung.data.some((eintrag) => !eintrag.current)
                  ? " – Anforderungen auf aelteren Fassungen erreicht eine Aenderung nicht (§7)."
                  : null}
              </Alert>
            )}

            <Group>
              <Button type="submit" loading={anlegen.isPending || aendern.isPending}>
                Speichern
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {workflows.isPending ? <Loader /> : null}

      {workflows.data === undefined ? null : (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bezeichnung</Table.Th>
                <Table.Th>Art</Table.Th>
                <Table.Th>Betriebsart</Table.Th>
                <Table.Th>Zustaende</Table.Th>
                <Table.Th>Fassung</Table.Th>
                <Table.Th>Aktiv</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {workflows.data.map((workflow) => (
                <Table.Tr key={workflow.id}>
                  <Table.Td>{workflow.label}</Table.Td>
                  <Table.Td>{workflow.requirementType ?? "alle"}</Table.Td>
                  <Table.Td>{workflow.mode}</Table.Td>
                  <Table.Td>{workflow.states.length}</Table.Td>
                  <Table.Td>{workflow.version}</Table.Td>
                  <Table.Td>{workflow.active ? "ja" : "nein"}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" onClick={() => uebernehmen(workflow)}>
                      Bearbeiten
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
