"use client";

import { Alert, Button, Group, Modal, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { useState } from "react";
import { useFassungHeben, useZustandZuordnen, type Workflowzustand } from "@/lib/api/uebergaenge";

/** Der Dienst verlangt mindestens zehn Zeichen - hier vorweggenommen, statt erst dort. */
const MINDESTLAENGE = 10;

interface Eigenschaften {
  anforderungId: string;
  zustaende: Workflowzustand[];
  aktuellerZustand: string;
}

/**
 * Vorgaenge, die nur ein Administrator ausloest (ADR-0022 Punkt 5, ADR-0025 Punkt 4).
 *
 * **Beide aendern Regeln oder Zustand ausserhalb des Graphen** - deshalb liegen sie
 * abgesetzt unter den Uebergaengen und nicht zwischen ihnen. Wer sie benutzt, soll merken,
 * dass er den vorgesehenen Weg verlaesst.
 *
 * Beide verlangen eine Begruendung. Sie ist Bestandteil der Version, kein Kommentar
 * daneben: Wer den Vorgang Monate spaeter vorfindet, muss erkennen koennen, worauf er
 * beruhte.
 */
export function Verwaltungsvorgaenge({
  anforderungId,
  zustaende,
  aktuellerZustand,
}: Eigenschaften) {
  const zuordnen = useZustandZuordnen();
  const heben = useFassungHeben();
  const [vorgang, setVorgang] = useState<"zuordnung" | "hebung" | null>(null);
  const [begruendung, setBegruendung] = useState("");
  const [zielzustand, setZielzustand] = useState<string | null>(null);

  const schliessen = () => {
    setVorgang(null);
    setBegruendung("");
    setZielzustand(null);
  };

  const bestaetigen = () => {
    if (vorgang === "zuordnung" && zielzustand !== null) {
      zuordnen.mutate(
        { id: anforderungId, state: zielzustand, reason: begruendung },
        { onSuccess: schliessen },
      );
    }

    if (vorgang === "hebung") {
      heben.mutate({ id: anforderungId, reason: begruendung }, { onSuccess: schliessen });
    }
  };

  const laeuft = zuordnen.isPending || heben.isPending;
  const fehler = zuordnen.error ?? heben.error;
  const unvollstaendig =
    begruendung.trim().length < MINDESTLAENGE || (vorgang === "zuordnung" && zielzustand === null);

  return (
    <Stack gap="xs" pt="sm" mt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
      <Title order={4} size="h6" c="dimmed">
        Verwaltung
      </Title>

      <Group gap="xs">
        <Button size="xs" variant="light" onClick={() => setVorgang("zuordnung")}>
          Zustand zuordnen
        </Button>
        <Button size="xs" variant="light" onClick={() => setVorgang("hebung")}>
          Auf aktuelle Fassung heben
        </Button>
      </Group>

      {fehler !== null ? (
        <Alert color="red" title="Vorgang nicht moeglich">
          {fehler.message}
        </Alert>
      ) : null}

      <Modal
        opened={vorgang !== null}
        onClose={schliessen}
        title={vorgang === "zuordnung" ? "Zustand zuordnen" : "Auf aktuelle Fassung heben"}
      >
        <Stack gap="sm">
          {vorgang === "zuordnung" ? (
            <>
              <Text size="sm" c="dimmed">
                Setzt den Zustand ohne Uebergang. Der Vorgang wird in der Historie als Zuordnung
                ausgewiesen, nicht als Wechsel. Aktuell: „{aktuellerZustand}".
              </Text>
              <Select
                label="Zielzustand"
                data={zustaende.map((zustand) => ({
                  value: zustand.key,
                  label: `${zustand.label} (${zustand.key})`,
                }))}
                value={zielzustand}
                onChange={setZielzustand}
              />
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Bindet die Anforderung an die aktuelle Fassung ihres Workflows. Der Zustand bleibt
              unveraendert. Steht sie bereits auf der aktuellen Fassung, geschieht nichts.
            </Text>
          )}

          <Textarea
            label="Begruendung"
            description={`Mindestens ${MINDESTLAENGE} Zeichen`}
            rows={3}
            value={begruendung}
            onChange={(ereignis) => setBegruendung(ereignis.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={schliessen}>
              Abbrechen
            </Button>
            <Button loading={laeuft} disabled={unvollstaendig} onClick={bestaetigen}>
              Ausfuehren
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
