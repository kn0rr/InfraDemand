import { Anchor, Button, Container, Stack, Text, Title } from "@mantine/core";
import { istAngemeldet } from "@/lib/auth/sitzung";
import { holeSitzung } from "@/lib/auth/sitzung.server";

export const dynamic = "force-dynamic";

export default async function Startseite() {
  const sitzung = await holeSitzung();

  if (!istAngemeldet(sitzung)) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={1}>InfraDemand</Title>
          <Text>Nicht angemeldet.</Text>
          <Button component="a" href="/api/auth/login" w="fit-content">
            Anmelden
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>InfraDemand</Title>
        <Text>
          Angemeldet als {sitzung.anzeigename ?? sitzung.benutzername} (Quelle: {sitzung.quelle})
        </Text>
        <Text c="dimmed" size="sm">
          Rollen: {(sitzung.rollen ?? []).join(", ") || "keine"}
        </Text>
        <Anchor href="/anforderungen">Zu den Anforderungen</Anchor>
      </Stack>
    </Container>
  );
}
