import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

export interface TestOpa {
  url: string;
  stop(): Promise<void>;
}

/**
 * Startet OPA mit **derselben Konfiguration wie der Compose-Eintrag** - insbesondere mit
 * `--authorization=basic` und beiden Richtlinien.
 *
 * Das ist Absicht und nicht Bequemlichkeit: Weicht der Pfad, den der Client aufruft, von
 * der Freigabeliste in `authz.rego` ab, antwortet OPA mit 401. Liefe der Test gegen einen
 * ungeschuetzten Server, waere diese Abweichung erst im Betrieb zu bemerken.
 *
 * Dateien werden kopiert, nicht eingehaengt: Ein Bind-Mount verlangt einen absoluten Pfad
 * und verhaelt sich unter Windows und Linux verschieden.
 */
export async function startTestOpa(): Promise<TestOpa> {
  const container: StartedTestContainer = await new GenericContainer("openpolicyagent/opa:1.19.0")
    .withCopyFilesToContainer([
      { source: "policies/sichtbarkeit.rego", target: "/policies/sichtbarkeit.rego" },
      { source: "policies/authz.rego", target: "/policies/authz.rego" },
    ])
    .withCommand(["run", "--server", "--addr=0.0.0.0:8181", "--authorization=basic", "/policies"])
    .withExposedPorts(8181)
    // Prueft von auszen, dass der Server antwortet - im Abbild gibt es keinen
    // HTTP-Client. `/health` ist in authz.rego ausdruecklich freigegeben; wer die
    // Freigabe entfernt, laesst diesen Start scheitern.
    .withWaitStrategy(Wait.forHttp("/health", 8181))
    .start();

  return {
    url: `http://${container.getHost()}:${container.getMappedPort(8181)}`,
    stop: () => container.stop().then(() => undefined),
  };
}
