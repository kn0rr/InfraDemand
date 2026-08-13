"use client";

import {
  Alert,
  Autocomplete,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Fragment, useEffect, useState } from "react";
import { AttributFehler, useAnforderungAnlegen, useAnforderungen } from "@/lib/api/anforderungen";
import {
  useAttributdefinitionen,
  useBekannteAnforderungstypen,
  useHoheitsregeln,
} from "@/lib/api/attributdefinitionen";
import { Attributfeld, type Formularwerte } from "./attributfeld";
import { Zustandswechsel } from "./zustandswechsel";

const UUID_MUSTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pflichtfeld(wert: string): string | null {
  return wert.trim() === "" ? "Pflichtfeld" : null;
}

export function Anforderungsbereich({
  benutzer,
  istAdmin,
  mandanten,
}: {
  benutzer: string;
  istAdmin: boolean;
  mandanten: string[];
}) {
  const anforderungen = useAnforderungen();
  const anlegen = useAnforderungAnlegen();
  const typen = useBekannteAnforderungstypen();
  const regeln = useHoheitsregeln();

  const formular = useForm<Formularwerte>({
    mode: "uncontrolled",
    initialValues: {
      tenant: mandanten[0] ?? "",
      projectId: "",
      requirementType: "feature",
      owner: benutzer,
      dynamicAttributes: {},
    },
    // Diese Pruefung ist Bequemlichkeit, nicht Absicherung. Massgeblich ist der Service -
    // fuer alle drei Eingangswege aus §19.2 gleichermassen. Die dynamischen Attribute
    // werden hier bewusst **nicht** geprueft: Ihre Regeln stehen in den Definitionen, und
    // sie zweimal auszuformulieren hiesse, zwei Fassungen davon zu pflegen.
    validate: {
      tenant: pflichtfeld,
      projectId: (wert) => (UUID_MUSTER.test(wert) ? null : "Keine gueltige UUID"),
      requirementType: pflichtfeld,
      owner: pflichtfeld,
    },
  });

  const anforderungstyp = formular.getValues().requirementType;
  const definitionen = useAttributdefinitionen(anforderungstyp);

  // Felder unter `manual_locked` werden gar nicht erst angeboten - der Service wiese sie
  // ab, und ein Eingabefeld, dessen Inhalt nie ankommt, ist eine Zumutung.
  const gesperrt = new Set(
    (regeln.data ?? [])
      .filter((regel) => regel.mode === "manual_locked")
      .map((regel) => regel.field),
  );

  const bedienbar = (definitionen.data ?? []).filter(
    (definition) => definition.active && !gesperrt.has(definition.key),
  );
  // Genau eine Zeile offen: Zwei gleichzeitig geoeffnete Bereiche mit Schaltflaechen
  // laden zum Verwechseln ein, welche Anforderung gerade gemeint ist.
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null);
  // Wechselt der Anforderungstyp, wechselt die Feldmenge. Die bisherigen Werte gehoeren
  // zu Feldern, die es nun nicht mehr gibt - sie werden durch die Vorgabewerte der neuen
  // Definitionen ersetzt.
  useEffect(() => {
    if (definitionen.data === undefined) {
      return;
    }

    const vorgaben: Record<string, unknown> = {};
    for (const definition of definitionen.data) {
      if (definition.defaultValue !== null && definition.defaultValue !== undefined) {
        vorgaben[definition.key] = definition.defaultValue;
      }
    }

    formular.setFieldValue("dynamicAttributes", vorgaben);
  }, [definitionen.data, formular]);

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Title order={1}>Anforderungen</Title>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="subtle">
              Abmelden
            </Button>
          </form>
        </Group>

        <Paper withBorder p="md" radius="md">
          <form
            onSubmit={formular.onSubmit((werte) => {
              anlegen.mutate(werte, {
                onSuccess: () => formular.reset(),
                onError: (fehler) => {
                  // Der Service beanstandet feldbezogen (§6). Ohne diese Zuordnung
                  // stuende die Meldung als Text ueber dem Formular, und der Anwender
                  // muesste raten, welches Feld gemeint ist.
                  if (fehler instanceof AttributFehler) {
                    for (const eintrag of fehler.attribute) {
                      formular.setFieldError(`dynamicAttributes.${eintrag.key}`, eintrag.message);
                    }
                  }
                },
              });
            })}
          >
            <Stack gap="sm">
              <Title order={2} size="h4">
                Neue Anforderung
              </Title>

              <Group grow align="flex-start">
                <Select
                  label="Mandant"
                  description="Wem die Anforderung gehoert"
                  data={mandanten}
                  allowDeselect={false}
                  disabled={mandanten.length <= 1}
                  key={formular.key("tenant")}
                  {...formular.getInputProps("tenant")}
                />
                <TextInput
                  label="Projekt"
                  placeholder="11111111-1111-4111-8111-111111111111"
                  key={formular.key("projectId")}
                  {...formular.getInputProps("projectId")}
                />
                <Autocomplete
                  label="Art"
                  description="Bestimmt, welche Attribute gelten"
                  data={typen.data ?? []}
                  key={formular.key("requirementType")}
                  {...formular.getInputProps("requirementType")}
                />
              </Group>

              <Group grow align="flex-start">
                <TextInput
                  label="Verantwortlich"
                  key={formular.key("owner")}
                  {...formular.getInputProps("owner")}
                />
              </Group>

              {definitionen.isFetching ? <Loader size="sm" /> : null}

              {bedienbar.length > 0 ? (
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">
                    Attribute fuer „{anforderungstyp}"
                  </Text>
                  {bedienbar.map((definition) => (
                    <Attributfeld key={definition.id} definition={definition} formular={formular} />
                  ))}
                </Stack>
              ) : null}

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

        {anforderungen.isPending ? <Loader /> : null}

        {anforderungen.isError ? (
          <Alert color="red" title="Laden fehlgeschlagen">
            {anforderungen.error.message}
          </Alert>
        ) : null}

        {anforderungen.data !== undefined ? (
          anforderungen.data.length === 0 ? (
            <Text c="dimmed">Noch keine Anforderungen erfasst.</Text>
          ) : (
            <Table.ScrollContainer minWidth={700}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Art</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Verantwortlich</Table.Th>
                    <Table.Th>Attribute</Table.Th>
                    <Table.Th>Fassung</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {anforderungen.data.map((eintrag) => (
                    <Fragment key={eintrag.id}>
                      <Table.Tr
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setOffeneZeile((bisher) => (bisher === eintrag.id ? null : eintrag.id))
                        }
                      >
                        <Table.Td>{eintrag.requirementType}</Table.Td>
                        <Table.Td>{eintrag.status}</Table.Td>
                        <Table.Td>{eintrag.owner}</Table.Td>
                        <Table.Td>
                          {Object.entries(eintrag.dynamicAttributes)
                            .map(([schluessel, wert]) => `${schluessel}: ${String(wert)}`)
                            .join(", ") || "–"}
                        </Table.Td>
                        <Table.Td>{eintrag.version}</Table.Td>
                      </Table.Tr>

                      {offeneZeile === eintrag.id ? (
                        <Table.Tr>
                          <Table.Td colSpan={5}>
                            <Zustandswechsel anforderungId={eintrag.id} istAdmin={istAdmin} />
                          </Table.Td>
                        </Table.Tr>
                      ) : null}
                    </Fragment>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )
        ) : null}
      </Stack>
    </Container>
  );
}
