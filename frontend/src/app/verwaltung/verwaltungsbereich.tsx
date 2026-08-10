"use client";

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  type Hoheitsregel,
  useAlleAttributdefinitionen,
  useAlleHoheitsregeln,
  useAttributdefinitionAendern,
  useAttributdefinitionAnlegen,
  useFesthaltungen,
  useHoheitsregelAendern,
  useHoheitsregelAnlegen,
} from "@/lib/api/verwaltung";

const DATENTYPEN = ["text", "number", "boolean", "date", "enum", "multi_enum"] as const;

const MODI: { value: Hoheitsregel["mode"]; label: string }[] = [
  { value: "manual_allowed", label: "Manuell erlaubt (Vorgabe)" },
  { value: "automatic_wins", label: "Automatik hat Vorrang" },
  { value: "manual_locked", label: "Manuell gesperrt" },
];

/**
 * Deutet die Eingabe des Vorgabewerts nach dem gewaehlten Datentyp.
 *
 * Ein einzelnes Textfeld statt vier verschiedener: Der Vorgabewert wird selten gesetzt,
 * und ein Feld, das sich beim Umschalten des Typs veraendert, waere mehr Ueberraschung
 * als Hilfe. Was hier nicht passt, weist der Service ab.
 */
function deuteVorgabewert(
  eingabe: string,
  dataType: string,
): string | number | boolean | string[] | undefined {
  const wert = eingabe.trim();

  if (wert === "") {
    return undefined;
  }

  if (dataType === "number") {
    const zahl = Number(wert);
    return Number.isFinite(zahl) ? zahl : wert;
  }

  if (dataType === "boolean") {
    return wert === "true";
  }

  if (dataType === "multi_enum") {
    return wert
      .split(",")
      .map((eintrag) => eintrag.trim())
      .filter((eintrag) => eintrag !== "");
  }

  return wert;
}

function Attributdefinitionen() {
  const definitionen = useAlleAttributdefinitionen();
  const anlegen = useAttributdefinitionAnlegen();
  const aendern = useAttributdefinitionAendern();

  const formular = useForm({
    mode: "uncontrolled",
    initialValues: {
      key: "",
      requirementType: "",
      label: "",
      dataType: "text",
      allowedValues: "",
      required: false,
      defaultValue: "",
    },
  });

  return (
    <Stack gap="lg" pt="md">
      <Paper withBorder p="md" radius="md">
        <form
          onSubmit={formular.onSubmit((werte) => {
            const listentyp = werte.dataType === "enum" || werte.dataType === "multi_enum";

            anlegen.mutate(
              {
                key: werte.key,
                label: werte.label,
                dataType: werte.dataType as (typeof DATENTYPEN)[number],
                ...(werte.requirementType === "" ? {} : { requirementType: werte.requirementType }),
                ...(listentyp
                  ? {
                      allowedValues: werte.allowedValues
                        .split(",")
                        .map((eintrag) => eintrag.trim())
                        .filter((eintrag) => eintrag !== ""),
                    }
                  : {}),
                required: werte.required,
                ...(deuteVorgabewert(werte.defaultValue, werte.dataType) === undefined
                  ? {}
                  : { defaultValue: deuteVorgabewert(werte.defaultValue, werte.dataType) }),
              },
              { onSuccess: () => formular.reset() },
            );
          })}
        >
          <Stack gap="sm">
            <Title order={3} size="h5">
              Attribut definieren
            </Title>

            <Group grow align="flex-start">
              <TextInput
                label="Schluessel"
                description="Kleinbuchstaben, Ziffern, Unterstrich"
                key={formular.key("key")}
                {...formular.getInputProps("key")}
              />
              <TextInput
                label="Bezeichnung"
                key={formular.key("label")}
                {...formular.getInputProps("label")}
              />
            </Group>

            <Group grow align="flex-start">
              <TextInput
                label="Anforderungstyp"
                description="Leer bedeutet: gilt fuer alle"
                key={formular.key("requirementType")}
                {...formular.getInputProps("requirementType")}
              />
              <Select
                label="Datentyp"
                data={[...DATENTYPEN]}
                allowDeselect={false}
                key={formular.key("dataType")}
                {...formular.getInputProps("dataType")}
              />
            </Group>

            <TextInput
              label="Zulaessige Werte"
              description="Nur bei enum und multi_enum, durch Komma getrennt"
              key={formular.key("allowedValues")}
              {...formular.getInputProps("allowedValues")}
            />
            <TextInput
              label="Vorgabewert"
              description="Optional. Bei multi_enum durch Komma getrennt, bei boolean true oder false"
              key={formular.key("defaultValue")}
              {...formular.getInputProps("defaultValue")}
            />
            <Checkbox
              label="Pflichtfeld"
              description="Ohne Wert wird die Anforderung abgewiesen"
              key={formular.key("required")}
              {...formular.getInputProps("required", { type: "checkbox" })}
            />

            {anlegen.isError ? (
              <Alert color="red" title="Anlegen fehlgeschlagen">
                {anlegen.error.message}
              </Alert>
            ) : null}

            <Group justify="flex-end">
              <Button type="submit" loading={anlegen.isPending}>
                Anlegen
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {definitionen.isPending ? <Loader /> : null}

      {definitionen.data !== undefined ? (
        <Table.ScrollContainer minWidth={800}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Schluessel</Table.Th>
                <Table.Th>Gilt fuer</Table.Th>
                <Table.Th>Typ</Table.Th>
                <Table.Th>Pflicht</Table.Th>
                <Table.Th>Fassung</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {definitionen.data.map((definition) => (
                <Table.Tr key={definition.id} opacity={definition.active ? 1 : 0.5}>
                  <Table.Td>{definition.key}</Table.Td>
                  <Table.Td>{definition.requirementType ?? "alle"}</Table.Td>
                  <Table.Td>{definition.dataType}</Table.Td>
                  <Table.Td>{definition.required ? "ja" : "nein"}</Table.Td>
                  <Table.Td>{definition.version}</Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color={definition.active ? "red" : "blue"}
                      onClick={() =>
                        aendern.mutate({
                          id: definition.id,
                          werte: {
                            label: definition.label,
                            dataType: definition.dataType,
                            required: definition.required,
                            active: !definition.active,
                            ...(definition.allowedValues === null
                              ? {}
                              : { allowedValues: definition.allowedValues }),
                          },
                        })
                      }
                    >
                      {definition.active ? "Ausser Kraft setzen" : "Wieder in Kraft setzen"}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : null}

      <Text size="sm" c="dimmed">
        Ausser Kraft gesetzte Definitionen werden nicht geloescht – bestehende Anforderungen tragen
        Werte, die ohne sie nicht mehr deutbar waeren.
      </Text>
    </Stack>
  );
}

function Hoheitsregeln() {
  const regeln = useAlleHoheitsregeln();
  const anlegen = useHoheitsregelAnlegen();
  const aendern = useHoheitsregelAendern();

  const formular = useForm({
    mode: "uncontrolled",
    initialValues: { field: "", mode: "automatic_wins" as Hoheitsregel["mode"] },
  });

  return (
    <Stack gap="lg" pt="md">
      <Paper withBorder p="md" radius="md">
        <form
          onSubmit={formular.onSubmit((werte) => {
            anlegen.mutate(werte, { onSuccess: () => formular.reset() });
          })}
        >
          <Stack gap="sm">
            <Title order={3} size="h5">
              Regel anlegen
            </Title>

            <Group grow align="flex-start">
              <TextInput
                label="Feld"
                description="Kernfeld wie owner oder Schluessel eines Attributs"
                key={formular.key("field")}
                {...formular.getInputProps("field")}
              />
              <Select
                label="Regel"
                data={MODI}
                allowDeselect={false}
                key={formular.key("mode")}
                {...formular.getInputProps("mode")}
              />
            </Group>

            {anlegen.isError ? (
              <Alert color="red" title="Anlegen fehlgeschlagen">
                {anlegen.error.message}
              </Alert>
            ) : null}

            <Group justify="flex-end">
              <Button type="submit" loading={anlegen.isPending}>
                Anlegen
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      {regeln.isPending ? <Loader /> : null}

      {regeln.data !== undefined ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Feld</Table.Th>
              <Table.Th>Regel</Table.Th>
              <Table.Th>Fassung</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {regeln.data.map((regel) => (
              <Table.Tr key={regel.id}>
                <Table.Td>{regel.field}</Table.Td>
                <Table.Td>
                  <Select
                    data={MODI}
                    value={regel.mode}
                    allowDeselect={false}
                    onChange={(wert) => {
                      if (wert !== null && wert !== regel.mode) {
                        aendern.mutate({ id: regel.id, mode: wert as Hoheitsregel["mode"] });
                      }
                    }}
                  />
                </Table.Td>
                <Table.Td>{regel.version}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}

      <Text size="sm" c="dimmed">
        Die Regel benennt eine Quellenklasse, kein System. Sie wirkt deshalb nur dort, wo eine
        automatische Quelle das Feld tatsaechlich bespielt.
      </Text>
    </Stack>
  );
}

function Festhaltungen() {
  const festhaltungen = useFesthaltungen();

  return (
    <Stack gap="lg" pt="md">
      {festhaltungen.isPending ? <Loader /> : null}

      {festhaltungen.isError ? (
        <Alert color="red" title="Nicht ladbar">
          {festhaltungen.error.message}
        </Alert>
      ) : null}

      {festhaltungen.data?.length === 0 ? (
        <Text c="dimmed">Kein Feld ist festgehalten.</Text>
      ) : null}

      {festhaltungen.data !== undefined && festhaltungen.data.length > 0 ? (
        <Table.ScrollContainer minWidth={900}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Datensatz</Table.Th>
                <Table.Th>Feld</Table.Th>
                <Table.Th>Festgehaltener Wert</Table.Th>
                <Table.Th>Herkunftssystem liefert</Table.Th>
                <Table.Th>Seit</Table.Th>
                <Table.Th>Begruendung</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {festhaltungen.data.map((eintrag) => (
                <Table.Tr key={`${eintrag.requirementId}-${eintrag.field}`}>
                  <Table.Td>
                    {eintrag.sourceSystem}/{eintrag.externalId ?? "–"}
                  </Table.Td>
                  <Table.Td>{eintrag.field}</Table.Td>
                  <Table.Td>{String(eintrag.heldValue ?? "–")}</Table.Td>
                  <Table.Td>
                    {eintrag.lastRejection === null ? (
                      <Text size="sm" c="dimmed">
                        bisher nichts abweichendes
                      </Text>
                    ) : (
                      <Group gap="xs">
                        <Text size="sm">{String(eintrag.lastRejection.value ?? "–")}</Text>
                        <Badge size="sm" color="orange">
                          {eintrag.lastRejection.count}×
                        </Badge>
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>{new Date(eintrag.heldSince).toLocaleDateString("de-DE")}</Table.Td>
                  <Table.Td>{eintrag.reason}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : null}

      <Text size="sm" c="dimmed">
        Festgehaltene Felder wachsen und schrumpfen nie von selbst. Diese Uebersicht ist die
        Voraussetzung fuer eine wiederkehrende Durchsicht, nicht ihr Ersatz.
      </Text>
    </Stack>
  );
}

export function Verwaltungsbereich() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>Verwaltung</Title>
          <Anchor href="/anforderungen">Zu den Anforderungen</Anchor>
        </Group>

        <Tabs defaultValue="attribute">
          <Tabs.List>
            <Tabs.Tab value="attribute">Attributdefinitionen</Tabs.Tab>
            <Tabs.Tab value="hoheit">Datenhoheit</Tabs.Tab>
            <Tabs.Tab value="festhaltungen">Festgehaltene Felder</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="attribute">
            <Attributdefinitionen />
          </Tabs.Panel>
          <Tabs.Panel value="hoheit">
            <Hoheitsregeln />
          </Tabs.Panel>
          <Tabs.Panel value="festhaltungen">
            <Festhaltungen />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
