"use client";

import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useAnforderungAnlegen, useAnforderungen } from "@/lib/api/anforderungen";

const UUID_MUSTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pflichtfeld(wert: string): string | null {
  return wert.trim() === "" ? "Pflichtfeld" : null;
}

export function Anforderungsbereich({ benutzer }: { benutzer: string }) {
  const anforderungen = useAnforderungen();
  const anlegen = useAnforderungAnlegen();

  const formular = useForm({
    mode: "uncontrolled",
    initialValues: {
      projectId: "",
      requirementType: "feature",
      status: "neu",
      owner: benutzer,
    },
    // Diese Pruefung ist Bequemlichkeit, nicht Absicherung. Massgeblich ist die
    // Pruefung im Service - sie gilt fuer alle drei Eingangswege aus §19.2
    // gleichermassen. Ab M3 entstehen diese Regeln aus den Attributdefinitionen (§6)
    // und werden nicht mehr von Hand geschrieben.
    validate: {
      projectId: (wert) => (UUID_MUSTER.test(wert) ? null : "Keine gueltige UUID"),
      requirementType: pflichtfeld,
      status: pflichtfeld,
      owner: pflichtfeld,
    },
  });

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
              anlegen.mutate(werte, { onSuccess: () => formular.reset() });
            })}
          >
            <Stack gap="sm">
              <Title order={2} size="h4">
                Neue Anforderung
              </Title>

              <Group grow align="flex-start">
                <TextInput
                  label="Projekt"
                  placeholder="11111111-1111-4111-8111-111111111111"
                  key={formular.key("projectId")}
                  {...formular.getInputProps("projectId")}
                />
                <TextInput
                  label="Art"
                  key={formular.key("requirementType")}
                  {...formular.getInputProps("requirementType")}
                />
              </Group>

              <Group grow align="flex-start">
                <TextInput
                  label="Status"
                  key={formular.key("status")}
                  {...formular.getInputProps("status")}
                />
                <TextInput
                  label="Verantwortlich"
                  key={formular.key("owner")}
                  {...formular.getInputProps("owner")}
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
                    <Table.Th>Herkunft</Table.Th>
                    <Table.Th>Fassung</Table.Th>
                    <Table.Th>Geaendert</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {anforderungen.data.map((eintrag) => (
                    <Table.Tr key={eintrag.id}>
                      <Table.Td>{eintrag.requirementType}</Table.Td>
                      <Table.Td>{eintrag.status}</Table.Td>
                      <Table.Td>{eintrag.owner}</Table.Td>
                      <Table.Td>{eintrag.sourceSystem}</Table.Td>
                      <Table.Td>{eintrag.version}</Table.Td>
                      <Table.Td>{new Date(eintrag.updatedAt).toLocaleString("de-DE")}</Table.Td>
                    </Table.Tr>
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
