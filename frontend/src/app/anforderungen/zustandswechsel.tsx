"use client";

import { Alert, Button, Group, Loader, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";
import { BedingungsFehler, useUebergaenge, useZustandswechsel } from "@/lib/api/uebergaenge";

interface Eigenschaften {
  anforderungId: string;
}

/**
 * Zulaessige Uebergaenge als Schaltflaechen statt eines freien Statusfeldes (§7, M4.5).
 *
 * **Gesperrte Uebergaenge werden angezeigt, nicht weggelassen.** Wer keine Schaltflaeche
 * sieht, weiss nicht, ob der Vorgang zu Ende ist oder ihm eine Rolle fehlt. Der Grund
 * steht am Knopf.
 *
 * Was zulaessig ist, entscheidet der Dienst - hier wird nichts nachgerechnet. Eine zweite
 * Fassung der Pruefung im Browser boete bei der ersten Abweichung falsche Schaltflaechen an.
 */
export function Zustandswechsel({ anforderungId }: Eigenschaften) {
  const uebergaenge = useUebergaenge(anforderungId);
  const wechsel = useZustandswechsel();
  const [begruendungFuer, setBegruendungFuer] = useState<string | null>(null);
  const [begruendung, setBegruendung] = useState("");

  if (uebergaenge.isPending) {
    return <Loader size="sm" />;
  }

  if (uebergaenge.isError) {
    return (
      <Alert color="red" title="Uebergaenge nicht ladbar">
        {uebergaenge.error.message}
      </Alert>
    );
  }

  const auskunft = uebergaenge.data;

  const ausloesen = (toState: string, reason?: string) => {
    wechsel.mutate(
      { id: anforderungId, toState, reason },
      {
        onSuccess: () => {
          setBegruendungFuer(null);
          setBegruendung("");
        },
      },
    );
  };

  return (
    <Stack gap="sm">
      {auskunft.currentStateInWorkflow ? null : (
        <Alert color="yellow" title="Zustand nicht im Workflow">
          Der Zustand „{auskunft.currentState}" kommt im geltenden Workflow nicht vor. Bis ihn ein
          Administrator zuordnet, ist kein Uebergang moeglich – die Anforderung ist nicht
          abgeschlossen, sondern haengt.
        </Alert>
      )}

      {auskunft.currentStateInWorkflow && auskunft.transitions.length === 0 ? (
        <Text c="dimmed" size="sm">
          Von hier fuehrt kein Uebergang weiter – der Vorgang ist abgeschlossen.
        </Text>
      ) : null}

      <Group gap="md" align="flex-start">
        {auskunft.transitions.map((uebergang) => (
          <Stack key={uebergang.toState} gap={4} maw={280}>
            <Button
              size="xs"
              variant={uebergang.allowed ? "filled" : "default"}
              disabled={!uebergang.allowed}
              loading={wechsel.isPending}
              onClick={() =>
                uebergang.requiresReason
                  ? setBegruendungFuer(uebergang.toState)
                  : ausloesen(uebergang.toState)
              }
            >
              {uebergang.label}
            </Button>

            {/* Der Grund steht als Text, nicht im Tooltip: Ein Hinweis, den nur findet,
                wer mit der Maus darauf zeigt, erreicht weder Touch-Geraete noch
                Screenreader (§15). */}
            {uebergang.blockedBy.map((grund) => (
              <Text key={`${grund.kind}-${grund.message}`} size="xs" c="dimmed">
                {grund.message}
              </Text>
            ))}
          </Stack>
        ))}
      </Group>

      {wechsel.isError ? (
        <Alert color="red" title="Uebergang nicht moeglich">
          {wechsel.error instanceof BedingungsFehler ? (
            <Stack gap={2}>
              {wechsel.error.bedingungen.map((grund) => (
                <Text key={`${grund.kind}-${grund.message}`} size="sm">
                  {grund.message}
                </Text>
              ))}
            </Stack>
          ) : (
            wechsel.error.message
          )}
        </Alert>
      ) : null}

      <Modal
        opened={begruendungFuer !== null}
        onClose={() => setBegruendungFuer(null)}
        title="Begruendung"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Dieser Uebergang verlangt eine Begruendung. Sie wird als Bestandteil der Version
            festgehalten, nicht als Kommentar daneben.
          </Text>
          <Textarea
            label="Begruendung"
            rows={3}
            value={begruendung}
            onChange={(ereignis) => setBegruendung(ereignis.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setBegruendungFuer(null)}>
              Abbrechen
            </Button>
            <Button
              loading={wechsel.isPending}
              onClick={() =>
                begruendungFuer !== null ? ausloesen(begruendungFuer, begruendung) : undefined
              }
            >
              Uebergang ausloesen
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
