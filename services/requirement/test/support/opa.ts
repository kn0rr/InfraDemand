import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

export interface TestOpa {
  url: string;
  stop(): Promise<void>;
}

/**
 * Startet OPA mit **derselben Konfiguration wie der Compose-Eintrag** - insbesondere mit
 * `--authorization=basic` und dem vollstaendigen Richtlinienverzeichnis.
 *
 * Das ist Absicht und nicht Bequemlichkeit: Weicht der Pfad, den der Client aufruft, von
 * der Freigabeliste in `authz.rego` ab, antwortet OPA mit 401. Liefe der Test gegen einen
 * ungeschuetzten Server, waere diese Abweichung erst im Betrieb zu bemerken.
 *
 * Kopiert, nicht eingehaengt: Ein Bind-Mount verlangt einen absoluten Pfad und verhaelt
 * sich unter Windows und Linux verschieden.
 */
export async function startTestOpa(): Promise<TestOpa> {
  const container: StartedTestContainer = await new GenericContainer("openpolicyagent/opa:1.19.0")
    // Das ganze Verzeichnis und keine namentliche Liste: Eine Liste vergisst die naechste
    // Richtlinie, und der Fehler zeigt sich dann als 500 in Specs, die mit ihr nichts zu
    // tun haben - genau so ist `felder.rego` beim ersten Lauf gefehlt.
    .withCopyDirectoriesToContainer([{ source: "policies", target: "/policies" }])
    .withCommand(["run", "--server", "--addr=0.0.0.0:8181", "--authorization=basic", "/policies"])
    .withExposedPorts(8181)
    // Prueft von auszen, dass der Server antwortet - im Abbild gibt es keinen HTTP-Client.
    // `/health` ist in authz.rego ausdruecklich freigegeben; wer die Freigabe entfernt,
    // laesst diesen Start scheitern.
    .withWaitStrategy(Wait.forHttp("/health", 8181))
    .start();

  return {
    url: `http://${container.getHost()}:${container.getMappedPort(8181)}`,
    stop: () => container.stop().then(() => undefined),
  };
}
