import { Alert, Container, Stack, Title } from "@mantine/core";
import { redirect } from "next/navigation";
import { istAngemeldet } from "@/lib/auth/sitzung";
import { holeSitzung } from "@/lib/auth/sitzung.server";
import { Verwaltungsbereich } from "./verwaltungsbereich";

export const dynamic = "force-dynamic";

export default async function VerwaltungsSeite() {
  const sitzung = await holeSitzung();

  if (!istAngemeldet(sitzung)) {
    redirect("/api/auth/login?ziel=/verwaltung");
  }

  // Die Rolle wird hier **nur zur Darstellung** geprueft. Durchgesetzt wird sie im
  // Service (§8) - eine Pruefung im Frontend ist eine Bequemlichkeit fuer den Anwender,
  // keine Absicherung, und darf nie als solche gelten.
  if (!(sitzung.rollen ?? []).includes("platform-admin")) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={1}>Verwaltung</Title>
          <Alert color="yellow" title="Keine Berechtigung">
            Fuer diesen Bereich wird die Rolle <strong>platform-admin</strong> benoetigt.
          </Alert>
        </Stack>
      </Container>
    );
  }

  return <Verwaltungsbereich />;
}
